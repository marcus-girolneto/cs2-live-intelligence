import { sql } from "drizzle-orm";
import { secret } from "../../shared/crypto/tokens.js";
import type { Db } from "../../shared/db/database.js";

export interface ClaimedJob {
  id: string;
  ownerId: string;
  objectKey: string;
  leaseToken: string;
}
export type JobOutcome =
  { analysis: unknown; coaching: unknown } | { error: string };

/**
 * Worker queue over demo_jobs: leased claims (SKIP LOCKED), two attempts, fenced completion.
 * Jobs of plans with the priorityQueue feature (Pro) and of admins are claimed first.
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
      await tx.execute(
        sql`update demo_jobs set status='failed',error='Worker retry limit exceeded',updated_at=now() where status='processing' and lease_until<now() and attempts>=2`,
      );
      const r = await tx.execute(
        sql`select j.id,j.owner_id,j.object_key from demo_jobs j join users u on u.id=j.owner_id where u.telemetry_consent and (j.status='queued' or (j.status='processing' and j.lease_until<now() and j.attempts<2)) order by (case when u.role='admin' or exists(select 1 from subscriptions s join plans p on p.id=s.plan_id where s.owner_id=j.owner_id and s.status in ('active','trialing','past_due') and (s.current_period_end is null or s.current_period_end>now()) and (p.limits->>'priorityQueue')='true') then 0 else 1 end), j.created_at for update of j skip locked limit 1`,
      );
      const job = r.rows[0];
      if (!job) return undefined;
      const leaseToken = secret();
      await tx.execute(
        sql`update demo_jobs set status='processing',attempts=attempts+1,lease_token=${leaseToken},lease_until=now()+interval '180 seconds',updated_at=now() where id=${job.id}`,
      );
      return {
        id: job.id as string,
        ownerId: job.owner_id as string,
        objectKey: job.object_key as string,
        leaseToken,
      };
    });
  }

  async finish(
    id: string,
    leaseToken: string,
    outcome: JobOutcome,
  ): Promise<void> {
    if ("error" in outcome)
      await this.db.execute(
        sql`update demo_jobs set status='failed',error=${outcome.error},lease_until=null,lease_token=null,updated_at=now() where id=${id} and lease_token=${leaseToken} and status='processing'`,
      );
    else
      await this.db.execute(
        sql`update demo_jobs set status='complete',analysis=${JSON.stringify(outcome.analysis)}::jsonb,coaching=${JSON.stringify(outcome.coaching)}::jsonb,error=null,lease_until=null,lease_token=null,updated_at=now() where id=${id} and lease_token=${leaseToken} and status='processing' and exists(select 1 from users where id=demo_jobs.owner_id and telemetry_consent)`,
      );
  }
}
