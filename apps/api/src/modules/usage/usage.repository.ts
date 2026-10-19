import type { Db } from "../../shared/db/database.js";
import { sql } from "drizzle-orm";

export type CounterKind = "ai_review" | "upload";
export type LiveReservation = "ok" | "match_limit" | "match_cap";

/** Atomic per-day usage counters. Every reserve is check-and-consume in one statement/transaction. */
export interface UsageRepository {
  /** Consumes one unit when `limit` is null or the counter is below it; false when exhausted. */
  reserve(
    ownerId: string,
    day: string,
    kind: CounterKind,
    limit: number | null,
  ): Promise<boolean>;
  /** Gives one unit back (failed operation). */
  release(ownerId: string, day: string, kind: CounterKind): Promise<void>;
  used(ownerId: string, day: string, kind: CounterKind): Promise<number>;
  /**
   * Counts a live AI call: a new match needs a free match slot (`matchLimit`), calls inside an
   * already-counted match are capped at `perMatchCap`.
   */
  reserveLive(
    ownerId: string,
    day: string,
    matchKey: string,
    matchLimit: number | null,
    perMatchCap: number,
  ): Promise<LiveReservation>;
  /** Undoes a live call; a match whose only call failed stops counting. */
  releaseLive(ownerId: string, day: string, matchKey: string): Promise<void>;
  liveMatches(ownerId: string, day: string): Promise<number>;
}

export class PgUsageRepository implements UsageRepository {
  constructor(private readonly db: Db) {}
  async reserve(
    ownerId: string,
    day: string,
    kind: CounterKind,
    limit: number | null,
  ): Promise<boolean> {
    const cap = limit ?? 2147483647;
    // Single conditional upsert: concurrent requests serialize on the row and cannot overshoot.
    const r = await this.db.execute(
      sql`insert into usage_counters(owner_id,day,kind,count) select ${ownerId},${day}::date,${kind},1 where ${cap} > 0
        on conflict(owner_id,day,kind) do update set count=usage_counters.count+1 where usage_counters.count < ${cap} returning count`,
    );
    return r.rows.length > 0;
  }
  async release(
    ownerId: string,
    day: string,
    kind: CounterKind,
  ): Promise<void> {
    await this.db.execute(
      sql`update usage_counters set count=greatest(count-1,0) where owner_id=${ownerId} and day=${day}::date and kind=${kind}`,
    );
  }
  async used(ownerId: string, day: string, kind: CounterKind): Promise<number> {
    const r = await this.db.execute(
      sql`select count from usage_counters where owner_id=${ownerId} and day=${day}::date and kind=${kind}`,
    );
    return r.rows[0] ? Number(r.rows[0].count) : 0;
  }
  async reserveLive(
    ownerId: string,
    day: string,
    matchKey: string,
    matchLimit: number | null,
    perMatchCap: number,
  ): Promise<LiveReservation> {
    return this.db.transaction(async (tx) => {
      // Per-owner lock: counting matches and inserting a new one must not interleave.
      await tx.execute(
        sql`select pg_advisory_xact_lock(726221010, hashtext(${ownerId}))`,
      );
      const existing = await tx.execute(
        sql`select calls from usage_live_matches where owner_id=${ownerId} and day=${day}::date and match_key=${matchKey}`,
      );
      if (existing.rows[0]) {
        if (Number(existing.rows[0].calls) >= perMatchCap) return "match_cap";
        await tx.execute(
          sql`update usage_live_matches set calls=calls+1 where owner_id=${ownerId} and day=${day}::date and match_key=${matchKey}`,
        );
        return "ok";
      }
      if (matchLimit !== null) {
        const count = await tx.execute(
          sql`select count(*) as total from usage_live_matches where owner_id=${ownerId} and day=${day}::date and calls>0`,
        );
        if (Number(count.rows[0]!.total) >= matchLimit) return "match_limit";
      }
      await tx.execute(
        sql`insert into usage_live_matches(owner_id,day,match_key,calls) values(${ownerId},${day}::date,${matchKey},1)`,
      );
      return "ok";
    });
  }
  async releaseLive(
    ownerId: string,
    day: string,
    matchKey: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(726221010, hashtext(${ownerId}))`,
      );
      await tx.execute(
        sql`update usage_live_matches set calls=greatest(calls-1,0) where owner_id=${ownerId} and day=${day}::date and match_key=${matchKey}`,
      );
      await tx.execute(
        sql`delete from usage_live_matches where owner_id=${ownerId} and day=${day}::date and match_key=${matchKey} and calls=0`,
      );
    });
  }
  async liveMatches(ownerId: string, day: string): Promise<number> {
    const r = await this.db.execute(
      sql`select count(*) as total from usage_live_matches where owner_id=${ownerId} and day=${day}::date and calls>0`,
    );
    return Number(r.rows[0]!.total);
  }
}
