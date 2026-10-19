import { sql } from "drizzle-orm";
import { constantTimeEqual, digest } from "../../shared/crypto/tokens.js";
import type { Db } from "../../shared/db/database.js";
import type {
  DeviceAuthenticator,
  RoleLookup,
  SessionAuthenticator,
} from "../../shared/http/guards.js";
import type { DeviceIdentity, Role } from "../../shared/http/principal.js";
import type { DevAuthConfig } from "../../config/env.js";

export interface StaticOwner {
  token: string;
  ownerId: string;
}
export interface StaticDevice {
  deviceId: string;
  token: string;
  ownerId: string;
}

/**
 * In-memory identities for the database-less mode (local development and the live-path
 * tests): tokens compared in constant time; logout revokes the token for the process lifetime.
 */
export class StaticIdentity
  implements SessionAuthenticator, DeviceAuthenticator, RoleLookup
{
  private readonly revoked = new Set<string>();
  constructor(
    private readonly owners: StaticOwner[],
    private readonly devices: StaticDevice[],
  ) {}
  async ownerForToken(token: string): Promise<string | undefined> {
    if (this.revoked.has(token)) return undefined;
    return this.owners.find((o) => constantTimeEqual(token, o.token))?.ownerId;
  }
  async deviceForToken(token: string): Promise<DeviceIdentity | undefined> {
    const device = this.devices.find((d) => constantTimeEqual(token, d.token));
    return device
      ? { deviceId: device.deviceId, ownerId: device.ownerId }
      : undefined;
  }
  async role(): Promise<Role | undefined> {
    return "user";
  }
  revoke(token: string): void {
    this.revoked.add(token);
  }
}

/** Creates (idempotently) the development owner, its session token and collector. */
export class DevAccountSeeder {
  constructor(private readonly db: Db) {}
  async seed(dev: DevAuthConfig): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`insert into users(id,telemetry_consent) values(${dev.ownerId},true) on conflict(id) do nothing`,
      );
      await tx.execute(
        sql`insert into app_sessions(token_hash,owner_id,expires_at) values(${digest(dev.webToken)},${dev.ownerId},now()+interval '30 days') on conflict(token_hash) do update set expires_at=excluded.expires_at`,
      );
      await tx.execute(
        sql`insert into devices(id,owner_id,name,token_hash) values(${dev.deviceId},${dev.ownerId},'Development collector',${digest(dev.deviceToken)}) on conflict(id) do nothing`,
      );
    });
  }
}
