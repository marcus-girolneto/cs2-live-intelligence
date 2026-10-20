import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";
import {
  isoDate,
  isoOrNull,
  uuidOrNull,
  type Row,
} from "../../shared/db/rows.js";
import type { ApiKeyDto, ApiScope } from "./api-keys.dto.js";

export type NewApiKey = {
  ownerId: string;
  name: string;
  prefix: string;
  keyHash: string;
  scopes: ApiScope[];
  expiresAt: string | null;
};
/** The stored key matched by a hash, with its lifecycle state. */
export type StoredKey = {
  id: string;
  ownerId: string;
  scopes: ApiScope[];
  expired: boolean;
  revoked: boolean;
};

export interface ApiKeysRepository {
  list(ownerId: string): Promise<ApiKeyDto[]>;
  /** Inserts the key unless the owner already has `maxActive` active keys (undefined then). */
  create(key: NewApiKey, maxActive: number): Promise<ApiKeyDto | undefined>;
  /** Revokes an active key of the owner; false when there is none. */
  revoke(ownerId: string, id: string): Promise<boolean>;
  findByHash(keyHash: string): Promise<StoredKey | undefined>;
  /** Records a use (at most once a minute per key). */
  touch(id: string, networkHash: string | null): Promise<void>;
  /** Drops audit rows older than 365 days. */
  purgeEvents(): Promise<void>;
  /** Appends to the key audit trail. */
  event(
    ownerId: string,
    keyId: string | null,
    action: string,
    details?: Record<string, unknown>,
  ): Promise<void>;
}

const STATUS = sql.raw(
  `case when revoked_at is not null then 'revoked' when expires_at is not null and expires_at<=now() then 'expired' else 'active' end`,
);
const ACTIVE = sql.raw(
  `revoked_at is null and (expires_at is null or expires_at>now())`,
);

export function keyView(row: Row): ApiKeyDto {
  return {
    id: row.id as string,
    name: row.name as string,
    prefix: row.prefix as string,
    scopes: row.scopes as ApiScope[],
    createdAt: isoDate(row.created_at),
    lastUsedAt: isoOrNull(row.last_used_at),
    expiresAt: isoOrNull(row.expires_at),
    revokedAt: isoOrNull(row.revoked_at),
    status: row.status as ApiKeyDto["status"],
  };
}
const COLUMNS = sql.raw(
  `id,name,prefix,scopes,created_at,last_used_at,expires_at,revoked_at,`,
);
/** Postgres text[] literal of known-safe scope names. */
const textArray = (values: readonly string[]): string =>
  `{${values.map((v) => `"${v.replace(/["\\]/g, "")}"`).join(",")}}`;

export class PgApiKeysRepository implements ApiKeysRepository {
  constructor(private readonly db: Db) {}

  async list(ownerId: string): Promise<ApiKeyDto[]> {
    const r = await this.db.execute(
      sql`select ${COLUMNS}${STATUS} as status from api_keys where owner_id=${ownerId} order by created_at desc limit 100`,
    );
    return r.rows.map(keyView);
  }

  create(key: NewApiKey, maxActive: number): Promise<ApiKeyDto | undefined> {
    return this.db.transaction(async (tx) => {
      // Serializes concurrent creations of one owner so the active-key cap holds.
      await tx.execute(
        sql`select id from users where id=${key.ownerId} for update`,
      );
      const active = await tx.execute(
        sql`select count(*)::int as n from api_keys where owner_id=${key.ownerId} and ${ACTIVE}`,
      );
      if (Number(active.rows[0]?.n ?? 0) >= maxActive) return undefined;
      const r = await tx.execute(
        sql`insert into api_keys(id,owner_id,name,prefix,key_hash,scopes,expires_at) values(${randomUUID()},${key.ownerId},${key.name},${key.prefix},${key.keyHash},${textArray(key.scopes)}::text[],${key.expiresAt}::timestamptz) returning ${COLUMNS}${STATUS} as status`,
      );
      return keyView(r.rows[0]!);
    });
  }

  async revoke(ownerId: string, id: string): Promise<boolean> {
    const r = await this.db.execute(
      sql`update api_keys set revoked_at=now() where id=${uuidOrNull(id)} and owner_id=${ownerId} and revoked_at is null returning id`,
    );
    return r.rows.length > 0;
  }

  async findByHash(keyHash: string): Promise<StoredKey | undefined> {
    const r = await this.db.execute(
      sql`select id,owner_id,scopes,revoked_at is not null as revoked,(expires_at is not null and expires_at<=now()) as expired from api_keys where key_hash=${keyHash}`,
    );
    const row = r.rows[0];
    return row
      ? {
          id: row.id as string,
          ownerId: row.owner_id as string,
          scopes: row.scopes as ApiScope[],
          revoked: row.revoked === true,
          expired: row.expired === true,
        }
      : undefined;
  }

  async touch(id: string, networkHash: string | null): Promise<void> {
    await this.db.execute(
      sql`update api_keys set last_used_at=now(),last_used_ip_hash=coalesce(${networkHash},last_used_ip_hash) where id=${id} and (last_used_at is null or last_used_at<now()-interval '1 minute')`,
    );
  }

  async purgeEvents(): Promise<void> {
    await this.db.execute(
      sql`delete from api_key_events where created_at<now()-interval '365 days'`,
    );
  }

  async event(
    ownerId: string,
    keyId: string | null,
    action: string,
    details: Record<string, unknown> = {},
  ): Promise<void> {
    await this.db.execute(
      sql`insert into api_key_events(id,owner_id,key_id,action,details) values(${randomUUID()},${ownerId},${keyId},${action},${JSON.stringify(details)}::jsonb)`,
    );
  }
}
