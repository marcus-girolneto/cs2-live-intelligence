import { sql } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";
import { isoDate } from "../../shared/db/rows.js";

export type AutoReviewSettings = {
  enabled: boolean;
  tier: "quick" | "deep";
  lang: "en" | "pt";
};
export const DEFAULT_AUTO_REVIEW: AutoReviewSettings = {
  enabled: false,
  tier: "quick",
  lang: "en",
};
export type AutoReviewStatus =
  "queued" | "running" | "done" | "skipped" | "failed";
export type AutoReviewReason =
  | "not_in_demo"
  | "insufficient_credits"
  | "disabled"
  | "daily_cap"
  | "ai_unavailable"
  | "error";
export type AutoReviewRecord = {
  jobId: string;
  ownerId: string;
  status: AutoReviewStatus;
  reason: AutoReviewReason | null;
  reviewId: string | null;
  createdAt: string;
};

export function parseAutoReview(value: unknown): AutoReviewSettings {
  const v = (value && typeof value === "object" ? value : {}) as Record<
    string,
    unknown
  >;
  return {
    enabled: v.enabled === true,
    tier: v.tier === "deep" ? "deep" : "quick",
    lang: v.lang === "pt" ? "pt" : "en",
  };
}

/** Auto-review settings (coach profile) and the per-job auto-review state. */
export interface AutoReviewRepository {
  settings(ownerId: string): Promise<AutoReviewSettings>;
  saveSettings(ownerId: string, settings: AutoReviewSettings): Promise<void>;
  /** Completed jobs (recently finished) without an auto-review row. */
  pending(
    limit: number,
    sinceHours: number,
  ): Promise<{ jobId: string; ownerId: string }[]>;
  /** Inserts the queued row; false when another tick already claimed the job. */
  claim(jobId: string, ownerId: string): Promise<boolean>;
  update(
    jobId: string,
    status: AutoReviewStatus,
    reason?: AutoReviewReason | null,
    reviewId?: string | null,
  ): Promise<void>;
  /** Rows stuck in running (crashed process) older than `minutes` become failed. */
  expireRunning(minutes: number): Promise<number>;
  forJobs(ownerId: string, jobIds: string[]): Promise<AutoReviewRecord[]>;
}

export class PgAutoReviewRepository implements AutoReviewRepository {
  constructor(private readonly db: Db) {}

  async settings(ownerId: string): Promise<AutoReviewSettings> {
    const r = await this.db.execute(
      sql`select auto_review from coach_profiles where owner_id=${ownerId}`,
    );
    return parseAutoReview(r.rows[0]?.auto_review);
  }

  async saveSettings(ownerId: string, s: AutoReviewSettings): Promise<void> {
    await this.db.execute(
      sql`insert into coach_profiles(owner_id,auto_review) values(${ownerId},${JSON.stringify(s)}::jsonb) on conflict(owner_id) do update set auto_review=excluded.auto_review,updated_at=now()`,
    );
  }

  async pending(
    limit: number,
    sinceHours: number,
  ): Promise<{ jobId: string; ownerId: string }[]> {
    const r = await this.db.execute(
      sql`select j.id,j.owner_id from demo_jobs j left join auto_reviews a on a.job_id=j.id where j.status='complete' and a.job_id is null and j.updated_at > now() - make_interval(hours => ${sinceHours}) order by j.updated_at limit ${limit}`,
    );
    return r.rows.map((x) => ({
      jobId: x.id as string,
      ownerId: x.owner_id as string,
    }));
  }

  async claim(jobId: string, ownerId: string): Promise<boolean> {
    const r = await this.db.execute(
      sql`insert into auto_reviews(job_id,owner_id,status) values(${jobId},${ownerId},'queued') on conflict(job_id) do nothing returning job_id`,
    );
    return r.rows.length > 0;
  }

  async update(
    jobId: string,
    status: AutoReviewStatus,
    reason: AutoReviewReason | null = null,
    reviewId: string | null = null,
  ): Promise<void> {
    await this.db.execute(
      sql`update auto_reviews set status=${status},reason=${reason},review_id=${reviewId},attempts=attempts+${status === "running" ? 1 : 0},updated_at=now() where job_id=${jobId}`,
    );
  }

  async expireRunning(minutes: number): Promise<number> {
    const r = await this.db.execute(
      sql`update auto_reviews set status='failed',reason='error',updated_at=now() where status in ('running','queued') and updated_at < now() - make_interval(mins => ${minutes}) returning job_id`,
    );
    return r.rows.length;
  }

  async forJobs(
    ownerId: string,
    jobIds: string[],
  ): Promise<AutoReviewRecord[]> {
    if (!jobIds.length) return [];
    const r = await this.db.execute(
      sql`select job_id,owner_id,status,reason,review_id,created_at from auto_reviews where owner_id=${ownerId} and job_id in (${sql.join(
        jobIds.map((id) => sql`${id}`),
        sql`,`,
      )})`,
    );
    return r.rows.map((x) => ({
      jobId: x.job_id as string,
      ownerId: x.owner_id as string,
      status: x.status as AutoReviewStatus,
      reason: (x.reason as AutoReviewReason | null) ?? null,
      reviewId: (x.review_id as string | null) ?? null,
      createdAt: isoDate(x.created_at),
    }));
  }
}
