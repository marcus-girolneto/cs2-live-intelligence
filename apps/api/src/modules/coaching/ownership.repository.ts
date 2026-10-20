import { sql } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";
import { isoDate, uuidsOnly } from "../../shared/db/rows.js";
import type {
  AccountIdentity,
  MatchedBy,
  Ownership,
  OwnershipRecord,
} from "./ownership.policy.js";

/** A player of a match (name: display only, untrusted demo text). */
export type RosterPlayer = { steamId: string; name?: string };

/**
 * Match ownership ("mine"/"external") of each upload (columns of `uploads`), the account's
 * identity and the players of the uploads' matches (match_players, indexed).
 */
export interface OwnershipRepository {
  account(ownerId: string): Promise<AccountIdentity>;
  /** Sets the account-wide "this is me" player (non-Steam accounts). */
  setChosenPlayer(ownerId: string, steamId: string): Promise<void>;
  /** Classified uploads of the owner (optionally only `jobIds`). */
  records(ownerId: string, jobIds?: string[]): Promise<OwnershipRecord[]>;
  save(record: OwnershipRecord): Promise<void>;
  /** Completed uploads without an ownership (oldest first). */
  unclassified(limit: number): Promise<{ jobId: string; ownerId: string }[]>;
  /** Completed uploads of the owner without an ownership. */
  unclassifiedOf(ownerId: string): Promise<string[]>;
  /**
   * Players of the owner's completed uploads (upload id → players), optionally only `jobIds`
   * or only uploads where `steamId` played. Uploads that are not complete are absent.
   */
  rosters(
    ownerId: string,
    filter?: { jobIds?: string[]; steamId?: string },
  ): Promise<Map<string, RosterPlayer[]>>;
}

const row = (r: Record<string, unknown>): OwnershipRecord => ({
  jobId: r.id as string,
  ownerId: r.owner_id as string,
  ownership: r.ownership as Ownership,
  playerSteamId: (r.player_steam_id as string | null) ?? null,
  matchedBy: r.matched_by as MatchedBy,
  updatedAt: isoDate(r.ownership_updated_at),
});
const COMPLETE = sql.raw(
  `x.match_id is not null and not exists(select 1 from demo_jobs j where j.upload_id=x.id and j.kind='reparse' and j.status<>'done')`,
);
const idList = (ids: string[]) =>
  sql`(select jsonb_array_elements_text(${JSON.stringify(uuidsOnly(ids))}::jsonb)::uuid)`;

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
    const only = jobIds ? sql`and id in ${idList(jobIds)}` : sql``;
    const r = await this.db.execute(
      sql`select id,owner_id,ownership,player_steam_id,matched_by,ownership_updated_at from uploads where owner_id=${ownerId} and ownership is not null ${only}`,
    );
    return r.rows.map(row);
  }

  async save(record: OwnershipRecord): Promise<void> {
    await this.db.execute(
      sql`update uploads set ownership=${record.ownership},player_steam_id=${record.playerSteamId},matched_by=${record.matchedBy},ownership_updated_at=now() where id=${record.jobId} and owner_id=${record.ownerId}`,
    );
  }

  async unclassified(
    limit: number,
  ): Promise<{ jobId: string; ownerId: string }[]> {
    const r = await this.db.execute(
      sql`select id,owner_id from uploads where match_id is not null and ownership is null order by completed_at limit ${limit}`,
    );
    return r.rows.map((x) => ({
      jobId: x.id as string,
      ownerId: x.owner_id as string,
    }));
  }

  async unclassifiedOf(ownerId: string): Promise<string[]> {
    const r = await this.db.execute(
      sql`select x.id from uploads x where x.owner_id=${ownerId} and x.ownership is null and ${COMPLETE} order by x.created_at desc limit 500`,
    );
    return r.rows.map((x) => x.id as string);
  }

  async rosters(
    ownerId: string,
    filter: { jobIds?: string[]; steamId?: string } = {},
  ): Promise<Map<string, RosterPlayer[]>> {
    const out = new Map<string, RosterPlayer[]>();
    if (filter.jobIds && !filter.jobIds.length) return out;
    const only = filter.jobIds
      ? sql`and x.id in ${idList(filter.jobIds)}`
      : sql``;
    const playing = filter.steamId
      ? sql`and exists(select 1 from match_players q where q.match_id=x.match_id and q.steam_id=${filter.steamId})`
      : sql``;
    const r = await this.db.execute(
      sql`select x.id,p.steam_id,p.name from uploads x left join match_players p on p.match_id=x.match_id where x.owner_id=${ownerId} and ${COMPLETE} ${only} ${playing} order by x.created_at desc,p.steam_id`,
    );
    for (const p of r.rows) {
      const list = out.get(p.id as string) ?? [];
      out.set(p.id as string, list);
      if (typeof p.steam_id !== "string") continue;
      list.push({
        steamId: p.steam_id as string,
        ...(typeof p.name === "string" ? { name: p.name } : {}),
      });
    }
    return out;
  }
}
