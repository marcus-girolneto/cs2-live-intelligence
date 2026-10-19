import { sql } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";
import { isoDate } from "../../shared/db/rows.js";
import type {
  AccountIdentity,
  MatchedBy,
  Ownership,
  OwnershipRecord,
} from "./ownership.policy.js";

/** Match ownership ("mine"/"external") per processed demo and the account's identity. */
export interface OwnershipRepository {
  account(ownerId: string): Promise<AccountIdentity>;
  /** Sets the account-wide "this is me" player (non-Steam accounts). */
  setChosenPlayer(ownerId: string, steamId: string): Promise<void>;
  records(ownerId: string, jobIds?: string[]): Promise<OwnershipRecord[]>;
  save(record: OwnershipRecord): Promise<void>;
  /** Completed jobs without an ownership row (oldest first). */
  unclassified(limit: number): Promise<{ jobId: string; ownerId: string }[]>;
}

const row = (r: Record<string, unknown>): OwnershipRecord => ({
  jobId: r.job_id as string,
  ownerId: r.owner_id as string,
  ownership: r.ownership as Ownership,
  playerSteamId: (r.player_steam_id as string | null) ?? null,
  matchedBy: r.matched_by as MatchedBy,
  updatedAt: isoDate(r.updated_at),
});

export class PgOwnershipRepository implements OwnershipRepository {
  constructor(private readonly db: Db) {}

  async account(ownerId: string): Promise<AccountIdentity> {
    const r = await this.db.execute(
      sql`select u.steam_id,c.player_steam_id from users u left join coach_profiles c on c.owner_id=u.id where u.id=${ownerId}`,
    );
    const first = r.rows[0] ?? {};
    return {
      steamId: (first.steam_id as string | null) ?? null,
      chosenSteamId: (first.player_steam_id as string | null) ?? null,
    };
  }

  async setChosenPlayer(ownerId: string, steamId: string): Promise<void> {
    await this.db.execute(
      sql`insert into coach_profiles(owner_id,player_steam_id) values(${ownerId},${steamId}) on conflict(owner_id) do update set player_steam_id=excluded.player_steam_id,updated_at=now()`,
    );
  }

  async records(
    ownerId: string,
    jobIds?: string[],
  ): Promise<OwnershipRecord[]> {
    if (jobIds && !jobIds.length) return [];
    const r = jobIds
      ? await this.db.execute(
          sql`select * from match_ownership where owner_id=${ownerId} and job_id in (${sql.join(
            jobIds.map((id) => sql`${id}`),
            sql`,`,
          )})`,
        )
      : await this.db.execute(
          sql`select * from match_ownership where owner_id=${ownerId}`,
        );
    return r.rows.map(row);
  }

  async save(record: OwnershipRecord): Promise<void> {
    await this.db.execute(
      sql`insert into match_ownership(job_id,owner_id,ownership,player_steam_id,matched_by) values(${record.jobId},${record.ownerId},${record.ownership},${record.playerSteamId},${record.matchedBy}) on conflict(job_id) do update set ownership=excluded.ownership,player_steam_id=excluded.player_steam_id,matched_by=excluded.matched_by,updated_at=now()`,
    );
  }

  async unclassified(
    limit: number,
  ): Promise<{ jobId: string; ownerId: string }[]> {
    const r = await this.db.execute(
      sql`select j.id,j.owner_id from demo_jobs j left join match_ownership m on m.job_id=j.id where j.status='complete' and m.job_id is null order by j.updated_at limit ${limit}`,
    );
    return r.rows.map((x) => ({
      jobId: x.id as string,
      ownerId: x.owner_id as string,
    }));
  }
}
