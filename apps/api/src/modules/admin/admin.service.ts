import { ConflictError, NotFoundError } from "../../shared/errors/index.js";
import type { UnitOfWork } from "../../shared/db/unit-of-work.js";
import type { Role } from "../../shared/http/principal.js";
import type { AdminUserDto, AuditEntryDto } from "./admin.dto.js";
import type { AdminRepository } from "./admin.repository.js";

/** Port (plans module): adds each user's plan to the admin users list. */
export interface UserPlans {
  withPlans<T extends { id: string }>(
    users: T[],
  ): Promise<Array<T & { plan: unknown }>>;
}
/** Port (ai-config): admin changes drop the cached AI snapshot. */
export interface SettingsCache {
  invalidate(): void;
}

/** User administration (roles, last-admin protection) and the audit log. */
export class AdminService {
  constructor(
    private readonly admin: AdminRepository,
    private readonly transaction: UnitOfWork<AdminRepository>,
    private readonly plans: UserPlans,
    private readonly cache: SettingsCache,
  ) {}

  async users(): Promise<{ users: AdminUserDto[] }> {
    return { users: await this.plans.withPlans(await this.admin.users()) };
  }

  /** Role change and its audit entry commit together; the last admin cannot be demoted. */
  async changeRole(
    adminId: string,
    userId: string,
    role: Role,
  ): Promise<AdminUserDto | undefined> {
    const result = await this.transaction.run(async (admin) => {
      const change = await admin.setRole(userId, role);
      if (change === "ok")
        await admin.record(adminId, "user.role", { userId, role });
      return change;
    });
    if (result === "not_found") throw new NotFoundError("User not found");
    if (result === "last_admin")
      throw new ConflictError("The last administrator cannot be demoted.");
    this.cache.invalidate();
    return (await this.plans.withPlans(await this.admin.users())).find(
      (u) => u.id === userId,
    );
  }

  async auditLog(limit: number): Promise<{ entries: AuditEntryDto[] }> {
    return { entries: await this.admin.auditLog(limit) };
  }
}
