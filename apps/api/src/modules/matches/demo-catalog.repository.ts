import { sql } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";
import {
  isoDate,
  isoOrNull,
  uuidOrNull,
  type Row,
} from "../../shared/db/rows.js";
import { ERROR, STATUS } from "./matches.repository.js";

/** One upload as the public API describes it (status, ownership and the match summary). */
export type DemoSummary = {
  id: string;
  filename: string;
  status: "queued" | "processing" | "complete" | "failed";
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  ownership: "mine" | "external" | null;
  playerSteamId: string | null;
  match: {
    map: string | null;
    rounds: number;
    score: { ct: number | null; t: number | null };
    tickRate: number | null;
    parserVersion: string | null;
    players: number;
  } | null;
};
export type PagedDemo = DemoSummary & { position: string };
export type DemoPageQuery = {
  limit: number;
  cursor?: { createdAt: string; id: string };
  ownership?: "mine" | "external";
  map?: string;
};

/** Cursor-paginated, filterable listing of an owner's uploads, and deletion of one upload. */
export interface DemoCatalog {
  /** Newest first; `position` is the item's exact (microsecond) creation time for cursors. */
  page(ownerId: string, query: DemoPageQuery): Promise<PagedDemo[]>;
  summary(ownerId: string, id: string): Promise<DemoSummary | undefined>;
  /**
   * Deletes the upload (its job, reviews and auto review cascade), queues its demo file for
   * removal and drops the match when no other upload references it.
   */
  remove(ownerId: string, id: string): Promise<boolean>;
}

const SELECT = sql`select u.id,u.filename,u.created_at,u.completed_at,u.ownership,u.player_steam_id,
  to_char(u.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as cursor_ts,
  ${STATUS} as status,${ERROR} as error,
  m.id as match_id,m.map,m.rounds_count,m.score_ct,m.score_t,m.tick_rate,m.parser_version,
  (select count(*)::int from match_players p where p.match_id=m.id) as players
  from uploads u left join demo_jobs j on j.upload_id=u.id
  left join matches m on m.id=u.match_id`;

function summaryView(row: Row): DemoSummary {
  const complete = row.status === "complete";
  return {
    id: row.id as string,
    filename: row.filename as string,
    status: row.status as DemoSummary["status"],
    error: (row.error as string | null) ?? null,
    createdAt: isoDate(row.created_at),
    completedAt: complete ? isoOrNull(row.completed_at) : null,
    ownership: (row.ownership as DemoSummary["ownership"]) ?? null,
    playerSteamId: (row.player_steam_id as string | null) ?? null,
    match:
      complete && row.match_id
        ? {
            map: (row.map as string | null) ?? null,
            rounds: Number(row.rounds_count ?? 0),
            score: {
              ct: (row.score_ct as number | null) ?? null,
              t: (row.score_t as number | null) ?? null,
            },
            tickRate: (row.tick_rate as number | null) ?? null,
            parserVersion: (row.parser_version as string | null) ?? null,
            players: Number(row.players ?? 0),
          }
        : null,
  };
}

export class PgDemoCatalog implements DemoCatalog {
  constructor(private readonly db: Db) {}

  async page(ownerId: string, query: DemoPageQuery): Promise<PagedDemo[]> {
    const cursor = query.cursor
      ? sql` and (u.created_at,u.id)<(${query.cursor.createdAt}::timestamptz,${uuidOrNull(query.cursor.id)}::uuid)`
      : sql``;
    const ownership = query.ownership
      ? sql` and u.ownership=${query.ownership}`
      : sql``;
    const map = query.map ? sql` and m.map=${query.map}` : sql``;
    const r = await this.db.execute(
      sql`${SELECT} where u.owner_id=${ownerId}${cursor}${ownership}${map} order by u.created_at desc,u.id desc limit ${query.limit}`,
    );
    return r.rows.map((row) => ({
      ...summaryView(row),
      position: row.cursor_ts as string,
    }));
  }

  async summary(ownerId: string, id: string): Promise<DemoSummary | undefined> {
    const r = await this.db.execute(
      sql`${SELECT} where u.owner_id=${ownerId} and u.id=${uuidOrNull(id)}`,
    );
    return r.rows[0] ? summaryView(r.rows[0]) : undefined;
  }

  remove(ownerId: string, id: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const r = await tx.execute(
        sql`delete from uploads where id=${uuidOrNull(id)} and owner_id=${ownerId} returning object_key,checksum`,
      );
      const row = r.rows[0];
      if (!row) return false;
      await tx.execute(
        sql`insert into file_deletions(object_key) values(${row.object_key}) on conflict(object_key) do update set processed_at=null,created_at=now()`,
      );
      await tx.execute(
        sql`select delete_unreferenced_matches(${row.checksum as string})`,
      );
      return true;
    });
  }
}
