import { sql } from "drizzle-orm";
import type { MatchBan } from "@cs2/contracts";
import type { Db } from "../../shared/db/database.js";
import { isoDate, uuidsOnly } from "../../shared/db/rows.js";

/** A match due for a Steam ban check. */
export interface DueMatch {
  /** Match id (bans are stored once per match, shared by its uploads). */
  jobId: string;
  /** When the match was first uploaded (approximates the match date). */
  uploadedAt: Date;
  checks: number;
  steamIds: string[];
}

/** Per-match Steam ban state (match_bans), deleted with the match; read per upload. */
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
  /** Ban rows of the given uploads' matches (uploads without a check are absent). */
  bansFor(
    uploadIds: string[],
  ): Promise<Map<string, { bans: MatchBan[]; checkedAt: string | null }>>;
}

export class PgIntegrityRepository implements IntegrityRepository {
  constructor(private readonly db: Db) {}

  async schedule(): Promise<void> {
    await this.db.execute(
      sql`insert into match_bans(match_id) select m.id from matches m where not exists(select 1 from match_bans b where b.match_id=m.id) on conflict do nothing`,
    );
  }

  async due(limit: number): Promise<DueMatch[]> {
    const r = await this.db.execute(
      sql`select b.match_id,b.checks,m.played_at,(select coalesce(jsonb_agg(p.steam_id order by p.steam_id),'[]'::jsonb) from match_players p where p.match_id=m.id) as ids from match_bans b join matches m on m.id=b.match_id where b.next_check_at is not null and b.next_check_at<=now() order by b.next_check_at limit ${limit}`,
    );
    return r.rows.map((row) => ({
      jobId: row.match_id as string,
      uploadedAt: new Date(row.played_at as string),
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
      sql`update match_bans set bans=${JSON.stringify(bans)}::jsonb,checks=checks+1,checked_at=now(),next_check_at=${nextCheckAt?.toISOString() ?? null} where match_id=${jobId}`,
    );
  }

  async bansFor(
    uploadIds: string[],
  ): Promise<Map<string, { bans: MatchBan[]; checkedAt: string | null }>> {
    const out = new Map<
      string,
      { bans: MatchBan[]; checkedAt: string | null }
    >();
    const ids = uuidsOnly(uploadIds);
    if (!ids.length) return out;
    const r = await this.db.execute(
      sql`select u.id,b.bans,b.checked_at from uploads u join match_bans b on b.match_id=u.match_id where u.id in (select jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)::uuid) and b.checked_at is not null`,
    );
    for (const row of r.rows)
      out.set(row.id as string, {
        bans: (Array.isArray(row.bans) ? row.bans : []) as MatchBan[],
        checkedAt: row.checked_at ? isoDate(row.checked_at) : null,
      });
    return out;
  }
}
