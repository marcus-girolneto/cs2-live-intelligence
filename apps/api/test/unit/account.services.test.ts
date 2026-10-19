import { describe, expect, it } from "vitest";
import type {
  AdminUserDto,
  AuditEntryDto,
} from "../../src/modules/admin/admin.dto.js";
import type {
  AdminRepository,
  RoleChange,
} from "../../src/modules/admin/admin.repository.js";
import { AdminService } from "../../src/modules/admin/admin.service.js";
import type { PairingCodeDto } from "../../src/modules/devices/devices.dto.js";
import type { DevicesRepository } from "../../src/modules/devices/devices.repository.js";
import { DevicesService } from "../../src/modules/devices/devices.service.js";
import type { SettingsDto } from "../../src/modules/privacy/privacy.dto.js";
import type { PrivacyRepository } from "../../src/modules/privacy/privacy.repository.js";
import { PrivacyService } from "../../src/modules/privacy/privacy.service.js";
import type { UnitOfWork } from "../../src/shared/db/unit-of-work.js";
import type { Role } from "../../src/shared/http/principal.js";
import { appError, RecordingInvalidation } from "./fakes.js";

class FakeAdmin implements AdminRepository {
  roles = new Map<string, Role>([
    ["a1", "admin"],
    ["u1", "user"],
  ]);
  audits: string[] = [];
  async users(): Promise<AdminUserDto[]> {
    return [...this.roles].map(([id, role]) => ({
      id,
      role,
      steamId: null,
      personaName: null,
      avatarUrl: null,
      createdAt: "",
      lastLoginAt: null,
      matches: 0,
      reviews: 0,
    }));
  }
  async setRole(id: string, role: Role): Promise<RoleChange> {
    const current = this.roles.get(id);
    if (!current) return "not_found";
    const admins = [...this.roles.values()].filter((r) => r === "admin").length;
    if (current === "admin" && role !== "admin" && admins <= 1)
      return "last_admin";
    this.roles.set(id, role);
    return "ok";
  }
  async record(_adminId: string, action: string) {
    this.audits.push(action);
  }
  async auditLog(): Promise<AuditEntryDto[]> {
    return [];
  }
}
/** Unit of work that records whether work ran inside it. */
class TrackingUnit implements UnitOfWork<AdminRepository> {
  runs = 0;
  constructor(private readonly repo: AdminRepository) {}
  async run<T>(work: (scope: AdminRepository) => Promise<T>): Promise<T> {
    this.runs++;
    return work(this.repo);
  }
}

describe("AdminService.changeRole", () => {
  const setup = () => {
    const repo = new FakeAdmin();
    const unit = new TrackingUnit(repo);
    let invalidated = 0;
    const service = new AdminService(
      repo,
      unit,
      {
        withPlans: async (users) =>
          users.map((u) => ({ ...u, plan: { id: "free" } })),
      },
      { invalidate: () => invalidated++ },
    );
    return { repo, unit, service, invalidated: () => invalidated };
  };
  it("404 for unknown users and 409 for the last admin, without auditing", async () => {
    const { repo, service, invalidated } = setup();
    expect(
      await appError(service.changeRole("a1", "x", "admin")),
    ).toMatchObject({
      status: 404,
      body: { error: "User not found" },
    });
    expect(
      await appError(service.changeRole("a1", "a1", "user")),
    ).toMatchObject({
      status: 409,
      body: { error: "The last administrator cannot be demoted." },
    });
    expect(repo.audits).toEqual([]);
    expect(invalidated()).toBe(0);
  });
  it("changes the role, audits inside the unit of work and returns the user with plan", async () => {
    const { repo, unit, service, invalidated } = setup();
    const user = await service.changeRole("a1", "u1", "admin");
    expect(user).toMatchObject({
      id: "u1",
      role: "admin",
      plan: { id: "free" },
    });
    expect(unit.runs).toBe(1);
    expect(repo.audits).toEqual(["user.role"]);
    expect(invalidated()).toBe(1);
    // Two admins now: demoting one is allowed.
    await service.changeRole("u1", "a1", "user");
    expect(repo.roles.get("a1")).toBe("user");
  });
});

class FakeDevices implements DevicesRepository {
  codes = 0;
  fail = false;
  existing = new Set(["d1"]);
  async deviceForToken() {
    return undefined;
  }
  async list() {
    return [];
  }
  async createPairingCode(): Promise<PairingCodeDto | undefined> {
    if (this.fail) throw new Error("db");
    return this.codes++ < 1 ? { code: "c", expiresAt: "t" } : undefined;
  }
  async claim(code: string) {
    return code === "good" ? { deviceId: "d2", token: "tok" } : undefined;
  }
  async rotate(_o: string, id: string) {
    return this.existing.has(id) ? { code: "r", expiresAt: "t" } : undefined;
  }
  async revoke(_o: string, id: string) {
    return this.existing.has(id);
  }
}

describe("DevicesService", () => {
  it("limits pairing codes (also when the repository fails) and validates claims", async () => {
    const repo = new FakeDevices();
    const service = new DevicesService(repo, new RecordingInvalidation());
    expect(await service.pair("o", "pc")).toEqual({
      code: "c",
      expiresAt: "t",
    });
    expect(await appError(service.pair("o", "pc"))).toMatchObject({
      status: 429,
      body: { error: "Pairing limit reached" },
    });
    repo.fail = true;
    expect((await appError(service.pair("o", "pc"))).status).toBe(429);
    expect(await service.claim("good")).toEqual({
      deviceId: "d2",
      token: "tok",
    });
    expect(await appError(service.claim("bad"))).toMatchObject({
      status: 400,
      body: { error: "Invalid or expired pairing code" },
    });
  });
  it("rotation/revocation invalidate the owner's live channels; unknown devices 404", async () => {
    const invalidation = new RecordingInvalidation();
    const service = new DevicesService(new FakeDevices(), invalidation);
    await service.rotate("o", "d1");
    await service.revoke("o", "d1");
    expect(invalidation.owners).toEqual(["o", "o"]);
    expect((await appError(service.rotate("o", "nope"))).body).toEqual({
      error: "Device not found",
    });
    expect((await appError(service.revoke("o", "nope"))).status).toBe(404);
    expect(invalidation.owners).toHaveLength(2);
  });
});

class FakePrivacy implements PrivacyRepository {
  saved: SettingsDto[] = [];
  deleted: string[] = [];
  async settings(): Promise<SettingsDto> {
    return {
      telemetryConsent: true,
      analyticsConsent: false,
      retentionDays: 30,
    };
  }
  async update(_o: string, s: SettingsDto) {
    this.saved.push(s);
  }
  async deleteAccount(o: string) {
    this.deleted.push(o);
  }
}

describe("PrivacyService", () => {
  const settings = (telemetryConsent: boolean): SettingsDto => ({
    telemetryConsent,
    analyticsConsent: true,
    retentionDays: 365,
  });
  it("clamps retention to the plan and only invalidates when consent is withdrawn", async () => {
    const repo = new FakePrivacy();
    const invalidation = new RecordingInvalidation();
    const service = new PrivacyService(repo, invalidation, {
      clampRetention: async (_o, days) => Math.min(days, 30),
    });
    expect((await service.update("o", settings(true))).retentionDays).toBe(30);
    expect(repo.saved[0]?.retentionDays).toBe(30);
    expect(invalidation.owners).toEqual([]);
    await service.update("o", settings(false));
    expect(invalidation.owners).toEqual(["o"]);
  });
  it("keeps the request without a retention limit; deletion invalidates", async () => {
    const repo = new FakePrivacy();
    const invalidation = new RecordingInvalidation();
    const service = new PrivacyService(repo, invalidation);
    expect((await service.update("o", settings(true))).retentionDays).toBe(365);
    await service.deleteAccount("o");
    expect(repo.deleted).toEqual(["o"]);
    expect(invalidation.owners).toEqual(["o"]);
  });
});
