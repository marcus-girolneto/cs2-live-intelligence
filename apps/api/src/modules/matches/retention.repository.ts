import { sql, type SQL } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";

/** Per-account retention and the deferred deletion of stored demo files. */
export interface RetentionRepository {
  /** Deletes everything older than each owner's retention and expired credentials. */
  retain(): Promise<void>;
  /** Object keys scheduled for deletion (oldest first, at most 100). */
  pendingDeletions(): Promise<string[]>;
  deletedFile(key: string): Promise<void>;
  /** Object keys still referenced by a job. */
  knownObjects(): Promise<Set<string>>;
}

const olderThanRetention = (column: string): SQL =>
  sql.raw(`${column}<now()-make_interval(days=>u.retention_days)`);

export class PgRetentionRepository implements RetentionRepository {
  constructor(private readonly db: Db) {}

  async retain(): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`insert into file_deletions(object_key) select j.object_key from demo_jobs j join users u on u.id=j.owner_id where ${olderThanRetention("j.created_at")} on conflict do nothing`,
      );
      await tx.execute(
        sql`delete from demo_jobs j using users u where j.owner_id=u.id and ${olderThanRetention("j.created_at")}`,
      );
      await tx.execute(
        sql`delete from live_sessions s using users u where s.owner_id=u.id and ${olderThanRetention("s.updated_at")}`,
      );
      for (const [table, alias] of [
        ["coach_live_calls", "c"],
        ["telemetry_events", "e"],
        ["product_events", "e"],
        ["feedback", "f"],
      ] as const)
        await tx.execute(
          sql`delete from ${sql.raw(`${table} ${alias}`)} using users u where ${sql.raw(`${alias}.owner_id`)}=u.id and ${olderThanRetention(`${alias}.created_at`)}`,
        );
      await tx.execute(sql`delete from pairing_codes where expires_at<now()`);
      await tx.execute(sql`delete from app_sessions where expires_at<now()`);
      await tx.execute(sql`delete from openid_states where expires_at<now()`);
      await tx.execute(sql`delete from auth_codes where expires_at<now()`);
      await tx.execute(
        sql`delete from openid_nonces where created_at<now()-interval '1 day'`,
      );
      await tx.execute(
        sql`delete from provider_usage where day<CURRENT_DATE-1`,
      );
    });
  }

  async pendingDeletions(): Promise<string[]> {
    const r = await this.db.execute(
      sql`select object_key from file_deletions order by created_at limit 100`,
    );
    return r.rows.map((row) => row.object_key as string);
  }

  async deletedFile(key: string): Promise<void> {
    await this.db.execute(
      sql`delete from file_deletions where object_key=${key}`,
    );
  }

  async knownObjects(): Promise<Set<string>> {
    const r = await this.db.execute(sql`select object_key from demo_jobs`);
    return new Set(r.rows.map((row) => row.object_key as string));
  }
}
