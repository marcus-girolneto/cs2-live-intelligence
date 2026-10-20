import { sql, type SQL } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";

/** Per-account retention, match reference counting and the object-storage deletion outbox. */
export interface RetentionRepository {
  /**
   * Deletes everything older than each owner's retention (uploads, live sessions, live calls,
   * telemetry, product events, feedback), matches no upload references any more, and expired
   * credentials. Demo and match files go to the deletion outbox.
   */
  retain(): Promise<void>;
  /** Object keys scheduled for deletion (oldest first, at most 100). */
  pendingDeletions(): Promise<string[]>;
  /** Marks a key deleted (kept in the outbox for a few days, then purged). */
  deletedFile(key: string): Promise<void>;
  /** Demo object keys of uploads and ids of stored matches (orphan sweep). */
  knownObjects(): Promise<{ demos: Set<string>; matches: Set<string> }>;
}

const olderThanRetention = (column: string): SQL =>
  sql.raw(`${column}<now()-make_interval(days=>u.retention_days)`);

export class PgRetentionRepository implements RetentionRepository {
  constructor(private readonly db: Db) {}

  async retain(): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`insert into file_deletions(object_key) select x.object_key from uploads x join users u on u.id=x.owner_id where ${olderThanRetention("x.created_at")} on conflict(object_key) do update set processed_at=null`,
      );
      await tx.execute(
        sql`delete from uploads x using users u where x.owner_id=u.id and ${olderThanRetention("x.created_at")}`,
      );
      await tx.execute(sql`select delete_unreferenced_matches()`);
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
    });
  }

  async pendingDeletions(): Promise<string[]> {
    const r = await this.db.execute(
      sql`select object_key from file_deletions where processed_at is null order by created_at limit 100`,
    );
    return r.rows.map((row) => row.object_key as string);
  }

  async deletedFile(key: string): Promise<void> {
    await this.db.execute(
      sql`update file_deletions set processed_at=now() where object_key=${key}`,
    );
  }

  async knownObjects(): Promise<{ demos: Set<string>; matches: Set<string> }> {
    const [demos, matches] = await Promise.all([
      this.db.execute(sql`select object_key from uploads`),
      this.db.execute(sql`select id from matches`),
    ]);
    return {
      demos: new Set(demos.rows.map((row) => row.object_key as string)),
      matches: new Set(matches.rows.map((row) => row.id as string)),
    };
  }
}
