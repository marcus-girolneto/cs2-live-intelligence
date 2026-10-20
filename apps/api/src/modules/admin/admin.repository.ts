import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";
import { isoDate, isoOrNull, stringOrNull } from "../../shared/db/rows.js";
import type { Role } from "../../shared/http/principal.js";
import type { AuditTrail } from "../../shared/ports/audit-trail.js";
import { ADMIN_ROLE_LOCK } from "../auth/auth.repository.js";
import type { AdminUserDto, AuditEntryDto } from "./admin.dto.js";

export type RoleChange = "ok" | "not_found" | "last_admin";

export interface AdminRepository extends AuditTrail {
  users(limit?: number): Promise<AdminUserDto[]>;
  /** Changes a role; refuses to leave the app without an admin. */
  setRole(userId: string, role: Role): Promise<RoleChange>;
  auditLog(limit: number): Promise<AuditEntryDto[]>;
}

export class PgAdminRepository implements AdminRepository {
  constructor(private readonly db: Db) {}

  async users(limit = 500): Promise<AdminUserDto[]> {
    const r = await this.db.execute(
      sql`select u.id,u.steam_id,u.role,u.display_name,u.avatar_url,u.created_at,u.last_login_at,
        (select count(*) from uploads x where x.owner_id=u.id) as matches,
        (select count(*) from ai_reviews r where r.owner_id=u.id and r.kind in ('quick','deep')) as reviews
        from users u order by u.created_at desc limit ${limit}`,
    );
    return r.rows.map((row) => ({
      id: row.id as string,
      steamId: stringOrNull(row.steam_id),
      personaName: stringOrNull(row.display_name),
      avatarUrl: stringOrNull(row.avatar_url),
      role: row.role === "admin" ? "admin" : "user",
      createdAt: isoDate(row.created_at),
      lastLoginAt: isoOrNull(row.last_login_at),
      matches: Number(row.matches),
      reviews: Number(row.reviews),
    }));
  }

  setRole(userId: string, role: Role): Promise<RoleChange> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${ADMIN_ROLE_LOCK})`);
      const target = await tx.execute(
        sql`select role from users where id=${userId} for update`,
      );
      if (!target.rows.length) return "not_found";
      if (target.rows[0]!.role === "admin" && role !== "admin") {
        const admins = await tx.execute(
          sql`select count(*) as total from users where role='admin'`,
        );
        if (Number(admins.rows[0]!.total) <= 1) return "last_admin";
      }
      await tx.execute(sql`update users set role=${role} where id=${userId}`);
      return "ok";
    });
  }

  async record(
    adminId: string,
    action: string,
    details: unknown,
  ): Promise<void> {
    await this.db.execute(
      sql`insert into admin_audit(id,admin_id,action,details) values(${randomUUID()},${adminId},${action},${JSON.stringify(details ?? {})}::jsonb)`,
    );
  }

  async auditLog(limit: number): Promise<AuditEntryDto[]> {
    const r = await this.db.execute(
      sql`select id,admin_id,action,details,created_at from admin_audit order by created_at desc limit ${limit}`,
    );
    return r.rows.map((row) => ({
      id: row.id as string,
      adminId: stringOrNull(row.admin_id),
      action: row.action as string,
      details: row.details,
      createdAt: isoDate(row.created_at),
    }));
  }
}
