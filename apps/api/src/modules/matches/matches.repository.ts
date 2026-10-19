import { sql } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";
import { isoDate, type Row } from "../../shared/db/rows.js";
import type {
  CompletedAnalysis,
  MatchDto,
  NewDemoJob,
  StoredAnalysis,
} from "./matches.dto.js";

const DEMO_JOB_LOCK = 726221002;
/** Per-owner and global storage quotas enforced atomically when a job is created. */
const QUOTA = {
  dailyUploads: 10,
  activeJobs: 2,
  ownerBytes: 512 * 1024 * 1024,
  globalBytes: 2 * 1024 * 1024 * 1024,
  globalJobs: 10000,
};

export class UploadRejectedError extends Error {}

/** Demo jobs as the owner sees them (uploads, matches, analyses, reprocessing). */
export interface MatchesRepository {
  /** Inserts a queued job; throws UploadRejectedError on consent or quota failure. */
  createJob(
    ownerId: string,
    file: NewDemoJob,
  ): Promise<{ id: string; status: "queued" }>;
  list(ownerId: string): Promise<MatchDto[]>;
  find(ownerId: string, id: string): Promise<MatchDto | undefined>;
  analysis(ownerId: string, id: string): Promise<StoredAnalysis | undefined>;
  /** The owner's latest completed analyses (newest first). */
  completedAnalyses(
    ownerId: string,
    limit?: number,
  ): Promise<CompletedAnalysis[]>;
  /** Finished jobs whose demo is still stored, optionally for one owner. */
  reprocessCandidates(
    ownerId?: string,
  ): Promise<{ id: string; objectKey: string }[]>;
  /** Puts finished jobs back in the queue; returns how many were queued. */
  requeue(ids: string[]): Promise<number>;
}

export function matchView(row: Row): MatchDto {
  return {
    id: row.id as string,
    filename: row.filename as string,
    status: row.status as string,
    createdAt: isoDate(row.created_at),
    ...(row.error ? { error: row.error as string } : {}),
    ...(row.status === "complete" ? { analysisId: row.id as string } : {}),
  };
}

export class PgMatchesRepository implements MatchesRepository {
  constructor(private readonly db: Db) {}

  createJob(
    ownerId: string,
    file: NewDemoJob,
  ): Promise<{ id: string; status: "queued" }> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${DEMO_JOB_LOCK})`);
      const account = await tx.execute(
        sql`select telemetry_consent from users where id=${ownerId} for update`,
      );
      if (!account.rows[0]?.telemetry_consent)
        throw new UploadRejectedError("Consent required");
      const quota = await tx.execute(
        sql`select count(*) filter(where created_at>now()-interval '24 hours') as daily,count(*) filter(where status in ('queued','processing')) as active,coalesce(sum(size),0) as bytes from demo_jobs where owner_id=${ownerId}`,
      );
      const q = quota.rows[0]!;
      if (
        Number(q.daily) >= QUOTA.dailyUploads ||
        Number(q.active) >= QUOTA.activeJobs ||
        Number(q.bytes) + file.size > QUOTA.ownerBytes
      )
        throw new UploadRejectedError("Upload quota reached");
      const global = await tx.execute(
        sql`select coalesce(sum(size),0) as bytes,count(*) as total from demo_jobs`,
      );
      const g = global.rows[0]!;
      if (
        Number(g.bytes) + file.size > QUOTA.globalBytes ||
        Number(g.total) >= QUOTA.globalJobs
      )
        throw new UploadRejectedError("Storage quota reached");
      await tx.execute(
        sql`insert into demo_jobs(id,owner_id,filename,object_key,checksum,size) values(${file.id},${ownerId},${file.filename},${file.objectKey},${file.checksum},${file.size})`,
      );
      return { id: file.id, status: "queued" as const };
    });
  }

  async list(ownerId: string): Promise<MatchDto[]> {
    const r = await this.db.execute(
      sql`select id,filename,status,created_at,error from demo_jobs where owner_id=${ownerId} order by created_at desc limit 100`,
    );
    return r.rows.map(matchView);
  }

  async find(ownerId: string, id: string): Promise<MatchDto | undefined> {
    const r = await this.db.execute(
      sql`select id,filename,status,created_at,error from demo_jobs where owner_id=${ownerId} and id=${id}`,
    );
    return r.rows[0] ? matchView(r.rows[0]) : undefined;
  }

  async analysis(
    ownerId: string,
    id: string,
  ): Promise<StoredAnalysis | undefined> {
    const r = await this.db.execute(
      sql`select id,analysis,coaching from demo_jobs where owner_id=${ownerId} and id=${id} and status='complete'`,
    );
    const row = r.rows[0];
    return row
      ? { id, analysis: row.analysis, coaching: row.coaching }
      : undefined;
  }

  async completedAnalyses(
    ownerId: string,
    limit = 50,
  ): Promise<CompletedAnalysis[]> {
    const r = await this.db.execute(
      sql`select id,filename,analysis,created_at from demo_jobs where owner_id=${ownerId} and status='complete' order by created_at desc limit ${limit}`,
    );
    return r.rows.map((row) => ({
      id: row.id as string,
      filename: row.filename as string,
      analysis: row.analysis,
      createdAt: isoDate(row.created_at),
    }));
  }

  async reprocessCandidates(
    ownerId?: string,
  ): Promise<{ id: string; objectKey: string }[]> {
    const r = await this.db.execute(
      ownerId
        ? sql`select j.id,j.object_key from demo_jobs j where j.status in ('complete','failed') and j.owner_id=${ownerId} and not exists(select 1 from file_deletions f where f.object_key=j.object_key) order by j.created_at limit 10000`
        : sql`select j.id,j.object_key from demo_jobs j where j.status in ('complete','failed') and not exists(select 1 from file_deletions f where f.object_key=j.object_key) order by j.created_at limit 10000`,
    );
    return r.rows.map((row) => ({
      id: row.id as string,
      objectKey: row.object_key as string,
    }));
  }

  async requeue(ids: string[]): Promise<number> {
    if (!ids.length) return 0;
    const r = await this.db.execute(
      sql`update demo_jobs set status='queued',attempts=0,error=null,lease_token=null,lease_until=null,updated_at=now() where id in (select jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)) and status in ('complete','failed') returning id`,
    );
    return r.rows.length;
  }
}
