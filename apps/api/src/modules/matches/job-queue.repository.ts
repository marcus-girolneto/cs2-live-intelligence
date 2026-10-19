import { sql } from "drizzle-orm";
import { secret } from "../../shared/crypto/tokens.js";
import type { Db } from "../../shared/db/database.js";

export interface ClaimedJob {
  id: string;
  ownerId: string;
  objectKey: string;
  leaseToken: string;
  /** SHA-256 of the demo (dedupe key). Optional for fakes. */
  checksum?: string;
  /** `reprocess`: a complete job re-parsed in the background after a parser upgrade. */
  kind?: "fresh" | "reprocess";
}
/**
 * A finished job. On success the analysis may come without its `events` array, which then lives
 * in object storage (`eventsCount` set).
 */
export type JobOutcome =
  | { analysis: unknown; coaching: unknown; eventsCount?: number }
  | { error: string };

const CLAIM_LOCK = 726221003;
const LEASE = sql.raw("interval '180 seconds'");
const PRIORITY = sql.raw(
  `(case when u.role='admin' or exists(select 1 from subscriptions s join plans p on p.id=s.plan_id where s.owner_id=j.owner_id and s.status in ('active','trialing','past_due') and (s.current_period_end is null or s.current_period_end>now()) and (p.limits->>'priorityQueue')='true') then 0 else 1 end)`,
);

/**
 * Worker queue over demo_jobs: leased claims (SKIP LOCKED), two attempts, fenced completion.
 * Fresh uploads first (jobs of plans with the priorityQueue feature (Pro) and of admins before
 * others); background re-parses after a parser upgrade only when no fresh job is waiting.
 * A job is not claimed while another job with the same checksum is being parsed, so two
 * simultaneous uploads of one file parse once (the second is deduplicated afterwards).
 */
export interface JobQueueRepository {
  claim(): Promise<ClaimedJob | undefined>;
  /** Completes a job only while the lease is still ours (and consent still holds). */
  finish(id: string, leaseToken: string, outcome: JobOutcome): Promise<void>;
}

export class PgJobQueueRepository implements JobQueueRepository {
  constructor(private readonly db: Db) {}

  claim(): Promise<ClaimedJob | undefined> {
    return this.db.transaction(async (tx) => {
      // Serializes claims (they are short) so the same-checksum check sees other claims.
      await tx.execute(sql`select pg_advisory_xact_lock(${CLAIM_LOCK})`);
      await tx.execute(
        sql`update demo_jobs set status='failed',error='Worker retry limit exceeded',updated_at=now() where status='processing' and lease_until<now() and attempts>=2`,
      );
      await tx.execute(
        sql`update demo_jobs set reprocess_state='failed',reprocess_error='Worker retry limit exceeded',lease_token=null,lease_until=null where reprocess_state='processing' and lease_until<now() and reprocess_attempts>=2`,
      );
      const r = await tx.execute(
        sql`select j.id,j.owner_id,j.object_key,j.checksum from demo_jobs j join users u on u.id=j.owner_id where u.telemetry_consent and (j.status='queued' or (j.status='processing' and j.lease_until<now() and j.attempts<2)) and not exists(select 1 from demo_jobs p where p.checksum=j.checksum and p.id<>j.id and (p.status='processing' or p.reprocess_state='processing') and p.lease_until>=now()) order by ${PRIORITY}, j.created_at for update of j skip locked limit 1`,
      );
      const fresh = r.rows[0];
      const leaseToken = secret();
      if (fresh) {
        await tx.execute(
          sql`update demo_jobs set status='processing',attempts=attempts+1,lease_token=${leaseToken},lease_until=now()+${LEASE},updated_at=now() where id=${fresh.id}`,
        );
        return this.claimed(fresh, leaseToken, "fresh");
      }
      const b = await tx.execute(
        sql`select j.id,j.owner_id,j.object_key,j.checksum from demo_jobs j join users u on u.id=j.owner_id where u.telemetry_consent and j.status='complete' and (j.reprocess_state='queued' or (j.reprocess_state='processing' and j.lease_until<now() and j.reprocess_attempts<2)) and not exists(select 1 from demo_jobs p where p.checksum=j.checksum and p.id<>j.id and (p.status='processing' or p.reprocess_state='processing') and p.lease_until>=now()) order by j.updated_at for update of j skip locked limit 1`,
      );
      const background = b.rows[0];
      if (!background) return undefined;
      await tx.execute(
        sql`update demo_jobs set reprocess_state='processing',reprocess_attempts=reprocess_attempts+1,lease_token=${leaseToken},lease_until=now()+${LEASE} where id=${background.id}`,
      );
      return this.claimed(background, leaseToken, "reprocess");
    });
  }

  private claimed(
    row: Record<string, unknown>,
    leaseToken: string,
    kind: "fresh" | "reprocess",
  ): ClaimedJob {
    return {
      id: row.id as string,
      ownerId: row.owner_id as string,
      objectKey: row.object_key as string,
      checksum: row.checksum as string,
      leaseToken,
      kind,
    };
  }

  async finish(
    id: string,
    leaseToken: string,
    outcome: JobOutcome,
  ): Promise<void> {
    if ("error" in outcome) {
      const r = await this.db.execute(
        sql`update demo_jobs set status='failed',error=${outcome.error},lease_until=null,lease_token=null,updated_at=now() where id=${id} and lease_token=${leaseToken} and status='processing'`,
      );
      // A failed background re-parse keeps the previous analysis.
      if (!r.rowCount)
        await this.db.execute(
          sql`update demo_jobs set reprocess_state='failed',reprocess_error=${outcome.error},lease_until=null,lease_token=null where id=${id} and lease_token=${leaseToken} and reprocess_state='processing'`,
        );
      return;
    }
    const analysis = JSON.stringify(outcome.analysis);
    const coaching = JSON.stringify(outcome.coaching);
    const events = outcome.eventsCount ?? null;
    const r = await this.db.execute(
      sql`update demo_jobs set status='complete',analysis=${analysis}::jsonb,coaching=${coaching}::jsonb,parser_version=${analysis}::jsonb->'provenance'->>'parserVersion',events_count=${events},error=null,lease_until=null,lease_token=null,updated_at=now() where id=${id} and lease_token=${leaseToken} and status='processing' and exists(select 1 from users where id=demo_jobs.owner_id and telemetry_consent)`,
    );
    if (!r.rowCount)
      await this.db.execute(
        sql`update demo_jobs set analysis=${analysis}::jsonb,coaching=${coaching}::jsonb,parser_version=${analysis}::jsonb->'provenance'->>'parserVersion',events_count=${events},reprocess_state=null,reprocess_error=null,lease_until=null,lease_token=null,updated_at=now() where id=${id} and lease_token=${leaseToken} and reprocess_state='processing' and exists(select 1 from users where id=demo_jobs.owner_id and telemetry_consent)`,
      );
  }
}
