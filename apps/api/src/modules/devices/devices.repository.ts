import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { digest, secret } from "../../shared/crypto/tokens.js";
import type { Db } from "../../shared/db/database.js";
import { isoDate, isoOrNull } from "../../shared/db/rows.js";
import type { DeviceAuthenticator } from "../../shared/http/guards.js";
import type { DeviceIdentity } from "../../shared/http/principal.js";
import type { DeviceDto, PairingCodeDto } from "./devices.dto.js";

const PAIRING_TTL_MS = 300000;
const MAX_ACTIVE_CODES = 10;
const MAX_DEVICES = 100;

export interface DevicesRepository extends DeviceAuthenticator {
  list(ownerId: string): Promise<DeviceDto[]>;
  /** New pairing code; undefined when the owner has 10 unexpired codes. */
  createPairingCode(
    ownerId: string,
    name: string,
  ): Promise<PairingCodeDto | undefined>;
  /** Consumes a code: creates the device (or re-keys a rotated one) and returns its token. */
  claim(code: string): Promise<{ deviceId: string; token: string } | undefined>;
  /** Invalidates the token and issues a re-pairing code for the same device. */
  rotate(
    ownerId: string,
    deviceId: string,
  ): Promise<PairingCodeDto | undefined>;
  revoke(ownerId: string, deviceId: string): Promise<boolean>;
}

export class PgDevicesRepository implements DevicesRepository {
  constructor(
    private readonly db: Db,
    private readonly now: () => number = Date.now,
  ) {}

  private expiry(): string {
    return new Date(this.now() + PAIRING_TTL_MS).toISOString();
  }

  async deviceForToken(token: string): Promise<DeviceIdentity | undefined> {
    const r = await this.db.execute(
      sql`select id,owner_id,token_hash from devices where token_hash=${digest(token)} and revoked_at is null`,
    );
    const row = r.rows[0];
    return row
      ? {
          deviceId: row.id as string,
          ownerId: row.owner_id as string,
          tokenHash: row.token_hash as string,
        }
      : undefined;
  }

  async list(ownerId: string): Promise<DeviceDto[]> {
    const r = await this.db.execute(
      sql`select id,name,created_at,revoked_at from devices where owner_id=${ownerId} order by created_at desc limit 100`,
    );
    return r.rows.map((row) => ({
      deviceId: row.id as string,
      name: row.name as string,
      createdAt: isoDate(row.created_at),
      revokedAt: isoOrNull(row.revoked_at),
    }));
  }

  async createPairingCode(
    ownerId: string,
    name: string,
  ): Promise<PairingCodeDto | undefined> {
    const code = secret();
    const expiresAt = this.expiry();
    const result = await this.db.execute(
      sql`insert into pairing_codes(code_hash,owner_id,name,expires_at) select ${digest(code)},${ownerId},${name},${expiresAt}::timestamptz where (select count(*) from pairing_codes where owner_id=${ownerId} and expires_at>now())<${MAX_ACTIVE_CODES} returning code_hash`,
    );
    return result.rows.length ? { code, expiresAt } : undefined;
  }

  claim(
    code: string,
  ): Promise<{ deviceId: string; token: string } | undefined> {
    return this.db.transaction(async (tx) => {
      const r = await tx.execute(
        sql`delete from pairing_codes where code_hash=${digest(code)} and expires_at>now() returning owner_id,name,device_id`,
      );
      const row = r.rows[0];
      if (!row) return undefined;
      const deviceId = (row.device_id as string) ?? randomUUID();
      const token = secret();
      if (row.device_id) {
        const updated = await tx.execute(
          sql`update devices set token_hash=${digest(token)} where id=${deviceId} and owner_id=${row.owner_id} and revoked_at is null returning id`,
        );
        if (!updated.rows.length) return undefined;
      } else {
        await tx.execute(
          sql`select id from users where id=${row.owner_id} for update`,
        );
        const count = await tx.execute(
          sql`select count(*) as total from devices where owner_id=${row.owner_id}`,
        );
        if (Number(count.rows[0]!.total) >= MAX_DEVICES) return undefined;
        await tx.execute(
          sql`insert into devices(id,owner_id,name,token_hash) values(${deviceId},${row.owner_id},${row.name},${digest(token)})`,
        );
      }
      return { deviceId, token };
    });
  }

  rotate(ownerId: string, id: string): Promise<PairingCodeDto | undefined> {
    return this.db.transaction(async (tx) => {
      const device = await tx.execute(
        sql`select id,name from devices where id=${id} and owner_id=${ownerId} and revoked_at is null for update`,
      );
      if (!device.rows.length) return undefined;
      await tx.execute(
        sql`update devices set token_hash=${digest(secret())} where id=${id}`,
      );
      await tx.execute(sql`delete from pairing_codes where device_id=${id}`);
      const code = secret();
      const expiresAt = this.expiry();
      await tx.execute(
        sql`insert into pairing_codes(code_hash,owner_id,name,device_id,expires_at) values(${digest(code)},${ownerId},${device.rows[0]!.name},${id},${expiresAt}::timestamptz)`,
      );
      return { code, expiresAt };
    });
  }

  async revoke(ownerId: string, id: string): Promise<boolean> {
    const r = await this.db.execute(
      sql`update devices set revoked_at=now(),token_hash=${digest(secret())} where id=${id} and owner_id=${ownerId} returning id`,
    );
    return !!r.rows.length;
  }
}
