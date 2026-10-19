import { sql } from "drizzle-orm";
import type { MatchBan } from "@cs2/contracts";
import type { Db } from "../../shared/db/database.js";
import { isoDate } from "../../shared/db/rows.js";

/** A match due for a Steam ban check. */
export interface DueMatch {
  jobId: string;
  uploadedAt: Date;
  checks: number;
  steamIds: string[];
}

/** Per-match Steam ban state (match_bans), deleted with the match. */
export interface IntegrityRepository {
  /** Creates the pending check of complete matches that have none yet. */
  schedule(): Promise<void>;
  due(limit: number): Promise<DueMatch[]>;
  /** Stores a check; `nextCheckAt` null when no further check is planned. */
  save(
    jobId: string,
    bans: MatchBan[],
    nextCheckAt: Date | null,
  ): Promise<void>;
  /** Ban rows of the given jobs (jobs without a check are absent). */
  bansFor(
    jobIds: string[],
  ): Promise<Map<string, { bans: MatchBan[]; checkedAt: string | null }>>;
}

export class PgIntegrityRepository implements IntegrityRepository {
  constructor(private readonly db: Db) {}

  async schedule(): Promise<void> {
    await this.db.execute(
      sql`insert into match_bans(job_id) select j.id from demo_jobs j where j.status='complete' and not exists(select 1 from match_bans b where b.job_id=j.id) on conflict do nothing`,
    );
  }

  async due(limit: number): Promise<DueMatch[]> {
    const r = await this.db.execute(
      sql`select b.job_id,b.checks,j.created_at,(select coalesce(jsonb_agg(p->>'steamId'),'[]'::jsonb) from jsonb_array_elements(case when jsonb_typeof(j.analysis->'players')='array' then j.analysis->'players' else '[]'::jsonb end) p) as ids from match_bans b join demo_jobs j on j.id=b.job_id where j.status='complete' and b.next_check_at is not null and b.next_check_at<=now() order by b.next_check_at limit ${limit}`,
    );
    return r.rows.map((row) => ({
      jobId: row.job_id as string,
      uploadedAt: new Date(row.created_at as string),
      checks: Number(row.checks),
      steamIds: (Array.isArray(row.ids) ? row.ids : []).filter(
        (id): id is string => typeof id === "string",
      ),
    }));
  }

  async save(
    jobId: string,
    bans: MatchBan[],
    nextCheckAt: Date | null,
  ): Promise<void> {
    await this.db.execute(
      sql`update match_bans set bans=${JSON.stringify(bans)}::jsonb,checks=checks+1,checked_at=now(),next_check_at=${nextCheckAt?.toISOString() ?? null} where job_id=${jobId}`,
    );
  }

  async bansFor(
    jobIds: string[],
  ): Promise<Map<string, { bans: MatchBan[]; checkedAt: string | null }>> {
    const out = new Map<
      string,
      { bans: MatchBan[]; checkedAt: string | null }
    >();
    if (!jobIds.length) return out;
    const r = await this.db.execute(
      sql`select job_id,bans,checked_at from match_bans where job_id in (select jsonb_array_elements_text(${JSON.stringify(jobIds)}::jsonb)) and checked_at is not null`,
    );
    for (const row of r.rows)
      out.set(row.job_id as string, {
        bans: (Array.isArray(row.bans) ? row.bans : []) as MatchBan[],
        checkedAt: row.checked_at ? isoDate(row.checked_at) : null,
      });
    return out;
  }
}
