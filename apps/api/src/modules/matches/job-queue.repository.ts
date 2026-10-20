import { sql } from "drizzle-orm";
import { secret } from "../../shared/crypto/tokens.js";
import type { Db } from "../../shared/db/database.js";
import type { MatchRecord } from "./match-record.js";

export type JobKind = "parse" | "reparse" | "reprocess";

export interface ClaimedJob {
  /** Upload id (the job of an upload). */
  id: string;
  ownerId: string;
  objectKey: string;
  leaseToken: string;
  /** SHA-256 of the demo (dedupe key). Optional for fakes. */
  checksum?: string;
  /**
   * `fresh` (kind parse / reparse) or `reprocess` (a complete upload re-parsed in the
   * background after a parser upgrade). Optional for fakes.
   */
  kind?: "fresh" | "reprocess";
  /** Admin re-run: always parse again (no dedupe) and overwrite the match. */
  force?: boolean;
}

/** A finished job: the parsed match (its document already in object storage) or an error. */
export type JobOutcome = { match: MatchRecord } | { error: string };
/** Where the upload now points; `discarded` = a parse that lost a race (remove its files). */
export type FinishResult =
  | { status: "linked"; matchId: string; discarded?: string }
  | { status: "fenced" };

const CLAIM_LOCK = 726221003;
const LEASE = sql.raw("interval '180 seconds'");
const PLAYERS = sql.raw(
  `steam_id text,name text,team_start text,kills int,deaths int,assists int,adr real,kast real,hs_pct real,accuracy real,traded_deaths_pct real,opening_win_pct real,utility_damage_per_round real,rounds_played int`,
);

/**
 * Worker queue over demo_jobs (one row per upload): leased claims (SKIP LOCKED), two attempts,
 * fenced completion. Fresh uploads first (admins and plans with priorityQueue before others);
 * background re-parses after a parser upgrade only when no fresh job is waiting. A job is not
 * claimed while another job of the same demo bytes is being parsed, so simultaneous uploads of
 * one file parse once (the others are deduplicated afterwards).
 */
export interface JobQueueRepository {
  claim(): Promise<ClaimedJob | undefined>;
  /**
   * Completes a job only while the lease is still ours and the owner still consents: upserts
   * the match (one per checksum + parser version) and its players, and points the upload at it.
   */
  finish(
    id: string,
    leaseToken: string,
    outcome: JobOutcome,
  ): Promise<FinishResult | void>;
  /** The existing match of these demo bytes for a parser version (parse target). */
  matchFor(checksum: string, version: string): Promise<string | undefined>;
}

export class PgJobQueueRepository implements JobQueueRepository {
  constructor(private readonly db: Db) {}

  claim(): Promise<ClaimedJob | undefined> {
    return this.db.transaction(async (tx) => {
      // Serializes claims (they are short) so the same-checksum check sees other claims.
      await tx.execute(sql`select pg_advisory_xact_lock(${CLAIM_LOCK})`);
      await tx.execute(
        sql`update demo_jobs set status='failed',error='Worker retry limit exceeded',lease_token=null,lease_until=null,updated_at=now() where status='processing' and lease_until<now() and attempts>=2`,
      );
      const r = await tx.execute(
        sql`select j.upload_id,j.kind,u.owner_id,u.object_key,u.checksum from demo_jobs j join uploads u on u.id=j.upload_id join users o on o.id=u.owner_id where o.telemetry_consent and (j.status='queued' or (j.status='processing' and j.lease_until<now() and j.attempts<2)) and not exists(select 1 from demo_jobs p join uploads pu on pu.id=p.upload_id where pu.checksum=u.checksum and p.upload_id<>j.upload_id and p.status='processing' and p.lease_until>=now()) order by (j.kind='reprocess'),j.priority,j.created_at for update of j skip locked limit 1`,
      );
      const row = r.rows[0];
      if (!row) return undefined;
      const leaseToken = secret();
      await tx.execute(
        sql`update demo_jobs set status='processing',attempts=attempts+1,lease_token=${leaseToken},lease_until=now()+${LEASE},updated_at=now() where upload_id=${row.upload_id}`,
      );
      return {
        id: row.upload_id as string,
        ownerId: row.owner_id as string,
        objectKey: row.object_key as string,
        checksum: row.checksum as string,
        leaseToken,
        kind: row.kind === "reprocess" ? "reprocess" : "fresh",
        force: row.kind === "reparse",
      };
    });
  }

  async matchFor(
    checksum: string,
    version: string,
  ): Promise<string | undefined> {
    const r = await this.db.execute(
      sql`select id from matches where checksum=${checksum} and parser_version=${version}`,
    );
    return (r.rows[0]?.id as string | undefined) ?? undefined;
  }

  async finish(
    id: string,
    leaseToken: string,
    outcome: JobOutcome,
  ): Promise<FinishResult> {
    if ("error" in outcome) {
      await this.db.execute(
        sql`update demo_jobs set status='failed',error=${outcome.error},lease_until=null,lease_token=null,updated_at=now() where upload_id=${id} and lease_token=${leaseToken} and status='processing'`,
      );
      return { status: "fenced" };
    }
    const m = outcome.match;
    return this.db.transaction(async (tx) => {
      const job = await tx.execute(
        sql`select j.kind from demo_jobs j join uploads u on u.id=j.upload_id join users o on o.id=u.owner_id where j.upload_id=${id} and j.lease_token=${leaseToken} and j.status='processing' and o.telemetry_consent for update of j`,
      );
      if (!job.rows.length) return { status: "fenced" as const };
      const values = sql`${m.id},${m.checksum},${m.parserVersion},${m.map},${m.tickRate},${m.roundsCount},${m.scoreCt},${m.scoreT},${JSON.stringify(m.summary)}::jsonb,${JSON.stringify(m.coaching ?? null)}::jsonb,${m.analysisKey},${m.eventsCount},(select created_at from uploads where id=${id})`;
      const update = sql`do update set map=excluded.map,tick_rate=excluded.tick_rate,rounds_count=excluded.rounds_count,score_ct=excluded.score_ct,score_t=excluded.score_t,summary=excluded.summary,coaching=excluded.coaching,events_count=excluded.events_count,updated_at=now()`;
      const saved = await tx.execute(
        m.parserVersion === null
          ? sql`insert into matches(id,checksum,parser_version,map,tick_rate,rounds_count,score_ct,score_t,summary,coaching,analysis_key,events_count,played_at) values(${values}) on conflict(id) ${update} returning id`
          : sql`insert into matches(id,checksum,parser_version,map,tick_rate,rounds_count,score_ct,score_t,summary,coaching,analysis_key,events_count,played_at) values(${values}) on conflict(checksum,parser_version) ${update} returning id`,
      );
      const matchId = saved.rows[0]!.id as string;
      // A concurrent parse of the same bytes won: keep its files, point at its row.
      if (matchId === m.id) {
        await tx.execute(
          sql`delete from match_players where match_id=${matchId}`,
        );
        if (m.players.length)
          await tx.execute(
            sql`insert into match_players(match_id,steam_id,name,team_start,kills,deaths,assists,adr,kast,hs_pct,accuracy,traded_deaths_pct,opening_win_pct,utility_damage_per_round,rounds_played) select ${matchId},p.* from jsonb_to_recordset(${JSON.stringify(
              m.players.map((p) => ({
                steam_id: p.steamId,
                name: p.name,
                team_start: p.teamStart,
                kills: p.kills,
                deaths: p.deaths,
                assists: p.assists,
                adr: p.adr,
                kast: p.kast,
                hs_pct: p.hsPct,
                accuracy: p.accuracy,
                traded_deaths_pct: p.tradedDeathsPct,
                opening_win_pct: p.openingWinPct,
                utility_damage_per_round: p.utilityDamagePerRound,
                rounds_played: p.roundsPlayed,
              })),
            )}::jsonb) as p(${PLAYERS})`,
          );
      }
      await tx.execute(
        sql`update uploads set match_id=${matchId},completed_at=coalesce(case when ${job.rows[0]!.kind}='reprocess' then completed_at end,now()) where id=${id}`,
      );
      await tx.execute(
        sql`update demo_jobs set status='done',error=null,lease_until=null,lease_token=null,updated_at=now() where upload_id=${id}`,
      );
      // An upload moved to a newer parse may leave its previous match unreferenced.
      await tx.execute(sql`select delete_unreferenced_matches(${m.checksum})`);
      return {
        status: "linked" as const,
        matchId,
        ...(matchId === m.id ? {} : { discarded: m.id }),
      };
    });
  }
}
