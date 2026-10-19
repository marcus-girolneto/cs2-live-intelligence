import { sql } from "drizzle-orm";
import type { SteamProfile } from "../../infrastructure/steam/steam-profile.types.js";
import type { Db } from "../../shared/db/database.js";
import { isoDate } from "../../shared/db/rows.js";
import type { RoleLookup } from "../../shared/http/guards.js";
import type { Role } from "../../shared/http/principal.js";

/** The account row as GET /v1/me needs it (the cached profile is still unvalidated JSON). */
export interface AccountRecord {
  ownerId: string;
  role: Role;
  steamId?: string;
  memberSince?: string;
  steamProfile: unknown;
  steamProfileFetchedAt: Date | null;
}

export interface UsersRepository extends RoleLookup {
  account(ownerId: string): Promise<AccountRecord>;
  /** Caches the public Steam profile on a Steam-linked account (display only). */
  saveSteamProfile(ownerId: string, profile: SteamProfile): Promise<void>;
}

export class PgUsersRepository implements UsersRepository {
  constructor(private readonly db: Db) {}

  async role(ownerId: string): Promise<Role | undefined> {
    const r = await this.db.execute(
      sql`select role from users where id=${ownerId}`,
    );
    const role = r.rows[0]?.role;
    return role === "admin" ? "admin" : role === "user" ? "user" : undefined;
  }

  async account(ownerId: string): Promise<AccountRecord> {
    const r = await this.db.execute(
      sql`select steam_id,role,steam_profile,steam_profile_fetched_at,created_at from users where id=${ownerId}`,
    );
    const row = r.rows[0] ?? {};
    return {
      ownerId,
      role: row.role === "admin" ? "admin" : "user",
      ...(row.steam_id ? { steamId: row.steam_id as string } : {}),
      ...(row.created_at ? { memberSince: isoDate(row.created_at) } : {}),
      steamProfile: (row.steam_profile as unknown) ?? null,
      steamProfileFetchedAt: row.steam_profile_fetched_at
        ? new Date(row.steam_profile_fetched_at as string)
        : null,
    };
  }

  async saveSteamProfile(
    ownerId: string,
    profile: SteamProfile,
  ): Promise<void> {
    await this.db.execute(
      sql`update users set steam_profile=${JSON.stringify(profile)}::jsonb,steam_profile_fetched_at=${profile.fetchedAt}::timestamptz,display_name=${profile.personaName},avatar_url=${profile.avatarUrl ?? null},profile_url=${profile.profileUrl ?? null} where id=${ownerId} and steam_id is not null`,
    );
  }
}
