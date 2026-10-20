import { sql } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";
import {
  isoDate,
  uuidOrNull,
  uuidsOnly,
  type Row,
} from "../../shared/db/rows.js";
import type { MatchDto, NewDemoJob } from "./matches.dto.js";

const DEMO_JOB_LOCK = 726221002;
/** Per-owner and global storage quotas enforced atomically when an upload is created. */
const QUOTA = {
  dailyUploads: 10,
  activeJobs: 2,
  ownerBytes: 512 * 1024 * 1024,
  globalBytes: 2 * 1024 * 1024 * 1024,
  globalJobs: 10000,
};

export class UploadRejectedError extends Error {}

/** An upload's parsed match as stored in Postgres (the document is in object storage). */
export type MatchRow = {
  /** Upload id (= analysis id of every URL). */
  id: string;
  matchId: string;
  filename: string;
  /** Upload time. */
  createdAt: string;
  /** Slim summary (provenance, round outcomes, caveats). */
  summary: Record<string, unknown>;
  coaching: unknown;
};

/** Uploads as their owner sees them (list, status, analyses, admin re-runs). */
export interface MatchesRepository {
  /** Inserts the upload and its queued job; throws UploadRejectedError on consent or quota. */
  createJob(
    ownerId: string,
    file: NewDemoJob,
  ): Promise<{ id: string; status: "queued" }>;
  list(ownerId: string): Promise<MatchDto[]>;
  find(ownerId: string, id: string): Promise<MatchDto | undefined>;
  /** The owner's completed upload `id` with its match (undefined otherwise). */
  matchRow(ownerId: string, id: string): Promise<MatchRow | undefined>;
  /** The owner's completed uploads, newest first (optionally only `ids`). */
  completedRows(
    ownerId: string,
    limit?: number,
    ids?: readonly string[],
  ): Promise<MatchRow[]>;
  /** Match id of an upload (no owner check: callers checked ownership already). */
  matchIdOf(uploadId: string): Promise<string | undefined>;
  /** Finished uploads whose demo is still stored, optionally for one owner. */
  reprocessCandidates(
    ownerId?: string,
  ): Promise<{ id: string; objectKey: string }[]>;
  /** Puts finished uploads back in the queue (admin re-run); returns how many were queued. */
  requeue(ids: string[]): Promise<number>;
}

/** Whether the upload's analysis is visible (an admin re-run hides it until it is done). */
export const VISIBLE = sql.raw(
  `(u.match_id is not null and (j.upload_id is null or j.kind<>'reparse' or j.status='done'))`,
);
const STATUS = sql.raw(
  `case when (u.match_id is not null and (j.upload_id is null or j.kind<>'reparse' or j.status='done')) then 'complete' when j.status='processing' then 'processing' when j.status='failed' then 'failed' else 'queued' end`,
);
const ERROR = sql.raw(
  `case when j.status='failed' and not (u.match_id is not null and (j.kind<>'reparse' or j.status='done')) then j.error end`,
);
/** 0 for admins and plans with the priorityQueue feature (Pro), else 1 (owner alias `o`). */
export const PRIORITY = sql.raw(
  `(case when o.role='admin' or exists(select 1 from subscriptions s join plans p on p.id=s.plan_id where s.owner_id=o.id and s.status in ('active','trialing','past_due') and (s.current_period_end is null or s.current_period_end>now()) and (p.limits->>'priorityQueue')='true') then 0 else 1 end)`,
);

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

const matchRow = (row: Row): MatchRow => ({
  id: row.id as string,
  matchId: row.match_id as string,
  filename: row.filename as string,
  createdAt: isoDate(row.created_at),
  summary: (row.summary as Record<string, unknown> | null) ?? {},
  coaching: row.coaching ?? null,
});

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
        sql`select count(*) filter(where u.created_at>now()-interval '24 hours') as daily,count(*) filter(where j.status in ('queued','processing') and u.match_id is null) as active,coalesce(sum(u.size),0) as bytes from uploads u left join demo_jobs j on j.upload_id=u.id where u.owner_id=${ownerId}`,
      );
      const q = quota.rows[0]!;
      if (
        Number(q.daily) >= QUOTA.dailyUploads ||
        Number(q.active) >= QUOTA.activeJobs ||
        Number(q.bytes) + file.size > QUOTA.ownerBytes
      )
        throw new UploadRejectedError("Upload quota reached");
      const global = await tx.execute(
        sql`select coalesce(sum(size),0) as bytes,count(*) as total from uploads`,
      );
      const g = global.rows[0]!;
      if (
        Number(g.bytes) + file.size > QUOTA.globalBytes ||
        Number(g.total) >= QUOTA.globalJobs
      )
        throw new UploadRejectedError("Storage quota reached");
      await tx.execute(
        sql`insert into uploads(id,owner_id,filename,object_key,checksum,size) values(${file.id},${ownerId},${file.filename},${file.objectKey},${file.checksum},${file.size})`,
      );
      await tx.execute(
        sql`insert into demo_jobs(upload_id,priority) select ${file.id},${PRIORITY} from users o where o.id=${ownerId}`,
      );
      return { id: file.id, status: "queued" as const };
    });
  }

  async list(ownerId: string): Promise<MatchDto[]> {
    const r = await this.db.execute(
      sql`select u.id,u.filename,u.created_at,${STATUS} as status,${ERROR} as error from uploads u left join demo_jobs j on j.upload_id=u.id where u.owner_id=${ownerId} order by u.created_at desc limit 100`,
    );
    return r.rows.map(matchView);
  }

  async find(ownerId: string, id: string): Promise<MatchDto | undefined> {
    const r = await this.db.execute(
      sql`select u.id,u.filename,u.created_at,${STATUS} as status,${ERROR} as error from uploads u left join demo_jobs j on j.upload_id=u.id where u.owner_id=${ownerId} and u.id=${uuidOrNull(id)}`,
    );
    return r.rows[0] ? matchView(r.rows[0]) : undefined;
  }

  async matchRow(ownerId: string, id: string): Promise<MatchRow | undefined> {
    const r = await this.db.execute(
      sql`select u.id,u.match_id,u.filename,u.created_at,m.summary,m.coaching from uploads u join matches m on m.id=u.match_id left join demo_jobs j on j.upload_id=u.id where u.owner_id=${ownerId} and u.id=${uuidOrNull(id)} and ${VISIBLE}`,
    );
    return r.rows[0] ? matchRow(r.rows[0]) : undefined;
  }

  async completedRows(
    ownerId: string,
    limit = 50,
    ids?: readonly string[],
  ): Promise<MatchRow[]> {
    if (ids && !ids.length) return [];
    const only = ids
      ? sql`and u.id in (select jsonb_array_elements_text(${JSON.stringify(uuidsOnly(ids))}::jsonb)::uuid)`
      : sql``;
    const r = await this.db.execute(
      sql`select u.id,u.match_id,u.filename,u.created_at,m.summary,m.coaching from uploads u join matches m on m.id=u.match_id left join demo_jobs j on j.upload_id=u.id where u.owner_id=${ownerId} and ${VISIBLE} ${only} order by u.created_at desc limit ${limit}`,
    );
    return r.rows.map(matchRow);
  }

  async matchIdOf(uploadId: string): Promise<string | undefined> {
    const r = await this.db.execute(
      sql`select match_id from uploads where id=${uuidOrNull(uploadId)}`,
    );
    return (r.rows[0]?.match_id as string | null | undefined) ?? undefined;
  }

  async reprocessCandidates(
    ownerId?: string,
  ): Promise<{ id: string; objectKey: string }[]> {
    const owner = ownerId ? sql`and u.owner_id=${ownerId}` : sql``;
    const r = await this.db.execute(
      sql`select u.id,u.object_key from uploads u join demo_jobs j on j.upload_id=u.id where j.status in ('done','failed') ${owner} and not exists(select 1 from file_deletions f where f.object_key=u.object_key) order by u.created_at limit 10000`,
    );
    return r.rows.map((row) => ({
      id: row.id as string,
      objectKey: row.object_key as string,
    }));
  }

  async requeue(ids: string[]): Promise<number> {
    const valid = uuidsOnly(ids);
    if (!valid.length) return 0;
    const r = await this.db.execute(
      sql`update demo_jobs j set kind=case when u.match_id is null then 'parse' else 'reparse' end,status='queued',attempts=0,error=null,lease_token=null,lease_until=null,priority=${PRIORITY},updated_at=now() from uploads u join users o on o.id=u.owner_id where u.id=j.upload_id and j.upload_id in (select jsonb_array_elements_text(${JSON.stringify(valid)}::jsonb)::uuid) and j.status in ('done','failed') returning j.upload_id`,
    );
    return r.rows.length;
  }
}
