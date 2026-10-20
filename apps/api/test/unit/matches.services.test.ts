import { Readable } from "node:stream";
import { parserDeadlineMs } from "../../src/infrastructure/parser/demo-parser.js";
import { describe, expect, it } from "vitest";
import type { MatchesRepository } from "../../src/modules/matches/matches.repository.js";
import { MatchesService } from "../../src/modules/matches/matches.service.js";
import type { SampleDemoSource } from "../../src/modules/matches/sample-demo.service.js";
import { SampleDemoService } from "../../src/modules/matches/sample-demo.service.js";
import {
  DEFAULT_MAX_DEMO_BYTES,
  MAX_UPLOAD_CAP,
  UploadLimits,
} from "../../src/modules/matches/upload-limits.js";
import { UploadService } from "../../src/modules/matches/upload.service.js";
import type { ConsentLookup } from "../../src/modules/privacy/privacy.repository.js";
import { silentLogger } from "../../src/shared/logging/logger.js";
import { appError, CountingReservation, FakeObjectStorage } from "./fakes.js";
import { demoBytes } from "../support/demo-bytes.js";

class FakeMatches implements MatchesRepository {
  rejectCreate = false;
  created: string[] = [];
  requeued: string[] = [];
  async createJob(_o: string, file: { id: string }) {
    if (this.rejectCreate) throw new Error("quota");
    this.created.push(file.id);
    return { id: file.id, status: "queued" as const };
  }
  async list() {
    return [];
  }
  async find() {
    return undefined;
  }
  async matchRow() {
    return undefined;
  }
  async completedRows() {
    return [];
  }
  async matchIdOf() {
    return undefined;
  }
  async reprocessCandidates() {
    return [
      { id: "j1", objectKey: "a.dem" },
      { id: "j2", objectKey: "gone.dem" },
    ];
  }
  async requeue(ids: string[]) {
    this.requeued = ids;
    return ids.length;
  }
}
const consent = (telemetryConsent = true): ConsentLookup => ({
  settings: async () => ({
    telemetryConsent,
    analyticsConsent: false,
    retentionDays: 30,
  }),
});

function uploads(consentGiven = true) {
  const matches = new FakeMatches();
  const storage = new FakeObjectStorage();
  const reservation = new CountingReservation();
  const service = new UploadService(
    matches,
    storage,
    consent(consentGiven),
    { reserveUpload: async () => reservation },
    { maxDemoBytes: async () => 100 },
  );
  return { matches, storage, reservation, service };
}
const OCTET = "application/octet-stream";

describe("UploadService", () => {
  it("validates the deployment ceiling and clamps the admin setting to it", async () => {
    const setting = (maxDemoBytes: number) => ({
      settings: async () => ({ maxDemoBytes }),
    });
    expect(() => new UploadLimits(setting(1), 0)).toThrow(
      "Upload cap must be 1 byte..1 GiB",
    );
    expect(() => new UploadLimits(setting(1), MAX_UPLOAD_CAP + 1)).toThrow();
    expect(
      await new UploadLimits(
        setting(DEFAULT_MAX_DEMO_BYTES),
        MAX_UPLOAD_CAP,
      ).maxDemoBytes(),
    ).toBe(524_288_000);
    expect(
      await new UploadLimits(
        setting(DEFAULT_MAX_DEMO_BYTES),
        1000,
      ).maxDemoBytes(),
    ).toBe(1000);
  });
  it("admits in order: consent, concurrency, declared size, content type", async () => {
    expect(
      (await appError(uploads(false).service.admit("o", 1, OCTET))).body,
    ).toEqual({ error: "Telemetry consent required" });
    const { service } = uploads();
    expect((await appError(service.admit("o", 101, OCTET))).status).toBe(413);
    expect(
      (await appError(service.admit("o", 1, "application/json"))).status,
    ).toBe(415);
    const slots = await Promise.all(
      [1, 2, 3, 4].map(() => service.admit("o", 1, OCTET)),
    );
    expect((await appError(service.admit("o", 1, OCTET))).body).toEqual({
      error: "Upload concurrency reached",
    });
    slots[0]!.finish();
    slots[0]!.finish();
    await service.admit("o", 1, OCTET);
    expect((await appError(service.admit("o", 1, OCTET))).status).toBe(429);
  });
  it("stores bodies with filename and size checks (plain status errors)", async () => {
    const { service, storage } = uploads();
    const stored = await service.store(
      "match.dem",
      Readable.from([demoBytes("abc")]),
    );
    expect(stored).toMatchObject({
      filename: "match.dem",
      size: 65536,
      objectKey: `${stored.id}.dem`,
    });
    // The bytes decide, not the name or the declared content type.
    for (const [body, code] of [
      [Buffer.from("abc"), "not_cs2_demo"],
      [Buffer.from("MZ" + "x".repeat(70_000)), "not_cs2_demo"],
      [demoBytes("short", 4096), "too_small"],
    ] as const)
      expect(
        (await appError(service.store("m.dem", Readable.from([body])))).body,
      ).toMatchObject({ code });
    await expect(
      service.store("../x.dem", Readable.from([])),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      service.store("x.txt", Readable.from([])),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      service.store("empty.dem", Readable.from([])),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Empty demo upload",
    });
    expect(storage.removed).toHaveLength(1);
  });
  it("on enqueue failure removes the object and releases the quota exactly once", async () => {
    const { service, matches, storage, reservation } = uploads();
    const slot = await service.admit("o", 3, OCTET);
    const file = await service.store("m.dem", Readable.from([demoBytes("e")]));
    matches.rejectCreate = true;
    expect((await appError(service.enqueue(slot, file))).body).toEqual({
      error: "Upload quota reached or consent withdrawn",
    });
    expect(storage.removed).toEqual([file.objectKey]);
    await slot.releaseQuota();
    expect(reservation.released).toBe(1);
  });
});

function sample(enabled: boolean, source: Partial<SampleDemoSource> = {}) {
  const storage = new FakeObjectStorage();
  const reservation = new CountingReservation();
  const service = new SampleDemoService(
    {
      configured: () => true,
      available: async () => true,
      open: async () => Readable.from([Buffer.from("demo")]),
      ...source,
    },
    { sampleDemoEnabled: async () => enabled },
    new FakeMatches(),
    storage,
    consent(),
    { reserveUpload: async () => reservation },
    100,
  );
  return { service, storage, reservation };
}

describe("SampleDemoService", () => {
  it("is unavailable and 404 when disabled or unconfigured", async () => {
    expect(await sample(false).service.availability()).toEqual({
      available: false,
    });
    expect((await appError(sample(false).service.import("o"))).body).toEqual({
      error: "No sample demo is configured.",
    });
    expect(
      (
        await appError(
          sample(true, { configured: () => false }).service.import("o"),
        )
      ).status,
    ).toBe(404);
  });
  it("imports the sample as a queued job", async () => {
    const { service } = sample(true);
    expect(await service.availability()).toEqual({ available: true });
    expect((await service.import("o")).status).toBe("queued");
  });
  it("releases the quota and cleans up when the file cannot be copied", async () => {
    const { service, storage, reservation } = sample(true, {
      open: async () => {
        throw new Error("too big");
      },
    });
    expect((await appError(service.import("o"))).body).toEqual({
      error: "The sample demo file is not available.",
    });
    expect(reservation.released).toBe(1);
    expect(storage.removed).toHaveLength(1);
  });
});

describe("MatchesService.reprocess", () => {
  it("re-queues jobs whose source is still stored and audits the counts", async () => {
    const matches = new FakeMatches();
    const storage = new FakeObjectStorage();
    storage.objects.set("a.dem", 1);
    const audits: unknown[] = [];
    const service = new MatchesService(
      matches,
      storage,
      { record: async (...args) => void audits.push(args) },
      silentLogger,
    );
    expect(await service.reprocess("admin", "owner")).toEqual({ queued: 1 });
    expect(matches.requeued).toEqual(["j1"]);
    expect(audits).toEqual([
      [
        "admin",
        "analyses.reprocess",
        { ownerId: "owner", candidates: 2, queued: 1, missingSource: 1 },
      ],
    ]);
    expect((await appError(service.get("o", "x"))).body).toEqual({
      error: "Match not found",
    });
  });
});

describe("parserDeadlineMs", () => {
  it("scales the parser deadline with the demo size, bounded to 30 minutes", () => {
    expect(parserDeadlineMs(120_000, 0)).toBe(120_000);
    expect(parserDeadlineMs(120_000, 500 * 1024 * 1024)).toBe(620_000);
    expect(parserDeadlineMs(120_000, 5 * 1024 * 1024 * 1024)).toBe(1_800_000);
  });
});
