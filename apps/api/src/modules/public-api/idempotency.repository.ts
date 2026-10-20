import { sql } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";

export type IdempotencyState =
  | { state: "new" }
  | { state: "pending" }
  | { state: "done"; status: number; response: unknown };

/** Idempotency-Key bookkeeping for POST /api/v1/demos (per account, 24 hours). */
export interface IdempotencyStore {
  /** Claims the key (new), or reports an in-flight (pending) or finished (done) request. */
  begin(ownerId: string, key: string): Promise<IdempotencyState>;
  complete(
    ownerId: string,
    key: string,
    status: number,
    response: unknown,
  ): Promise<void>;
  /** Forgets a claim whose request failed, so the client can retry with the same key. */
  abandon(ownerId: string, key: string): Promise<void>;
  /** Drops keys older than 24 hours. */
  purge(): Promise<void>;
}

export class PgIdempotencyStore implements IdempotencyStore {
  constructor(private readonly db: Db) {}

  begin(ownerId: string, key: string): Promise<IdempotencyState> {
    return this.db.transaction(async (tx) => {
      // Expired keys, and claims stuck for an hour (a crashed upload), are free again.
      await tx.execute(
        sql`delete from api_idempotency where owner_id=${ownerId} and key=${key} and (created_at<now()-interval '24 hours' or (status is null and created_at<now()-interval '1 hour'))`,
      );
      const claimed = await tx.execute(
        sql`insert into api_idempotency(owner_id,key) values(${ownerId},${key}) on conflict do nothing returning key`,
      );
      if (claimed.rows.length) return { state: "new" as const };
      const r = await tx.execute(
        sql`select status,response from api_idempotency where owner_id=${ownerId} and key=${key}`,
      );
      const row = r.rows[0];
      if (!row || row.status === null) return { state: "pending" as const };
      return {
        state: "done" as const,
        status: Number(row.status),
        response: row.response,
      };
    });
  }

  async complete(
    ownerId: string,
    key: string,
    status: number,
    response: unknown,
  ): Promise<void> {
    await this.db.execute(
      sql`update api_idempotency set status=${status},response=${JSON.stringify(response)}::jsonb where owner_id=${ownerId} and key=${key}`,
    );
  }

  async abandon(ownerId: string, key: string): Promise<void> {
    await this.db.execute(
      sql`delete from api_idempotency where owner_id=${ownerId} and key=${key} and status is null`,
    );
  }

  async purge(): Promise<void> {
    await this.db.execute(
      sql`delete from api_idempotency where created_at<now()-interval '24 hours'`,
    );
  }
}
