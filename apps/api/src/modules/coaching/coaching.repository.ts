import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";
import { isoDate } from "../../shared/db/rows.js";
import type {
  CoachProfileRecord,
  LiveCallRecord,
  NewLiveCall,
  NewReview,
  ReviewRecord,
} from "./coaching.dto.js";

/** Coach profile, stored AI reviews (with ratings) and live calls. */
export interface CoachingRepository {
  profile(ownerId: string): Promise<CoachProfileRecord>;
  saveProfile(
    ownerId: string,
    preferences: unknown,
    playerSteamId: string | null,
  ): Promise<void>;
  saveReview(review: NewReview): Promise<string>;
  reviews(ownerId: string, limit?: number): Promise<ReviewRecord[]>;
  /** false when the review does not exist or belongs to someone else. */
  rateReview(ownerId: string, id: string, rating: number): Promise<boolean>;
  saveLiveCall(call: NewLiveCall): Promise<string>;
  liveCalls(ownerId: string, limit?: number): Promise<LiveCallRecord[]>;
}

export class PgCoachingRepository implements CoachingRepository {
  constructor(private readonly db: Db) {}

  async profile(ownerId: string): Promise<CoachProfileRecord> {
    const r = await this.db.execute(
      sql`select c.preferences,c.player_steam_id,u.steam_id from users u left join coach_profiles c on c.owner_id=u.id where u.id=${ownerId}`,
    );
    const row = r.rows[0] ?? {};
    return {
      preferences: (row.preferences as unknown) ?? {},
      // A Steam-linked account is always coached as its own Steam identity.
      playerSteamId:
        ((row.steam_id ?? row.player_steam_id) as string | null) ?? null,
      linkedToSteam: !!row.steam_id,
    };
  }

  async saveProfile(
    ownerId: string,
    preferences: unknown,
    playerSteamId: string | null,
  ): Promise<void> {
    await this.db.execute(
      sql`insert into coach_profiles(owner_id,preferences,player_steam_id) values(${ownerId},${JSON.stringify(preferences)}::jsonb,${playerSteamId}) on conflict(owner_id) do update set preferences=excluded.preferences,player_steam_id=excluded.player_steam_id,updated_at=now()`,
    );
  }

  async saveReview(review: NewReview): Promise<string> {
    const id = randomUUID();
    await this.db.execute(
      sql`insert into coach_reviews(id,owner_id,analysis_id,steam_id,provider,model,prompt_version,lang,preferences,coaching,latency_ms,input_tokens,output_tokens) values(${id},${review.ownerId},${review.analysisId},${review.steamId},${review.provider},${review.model},${review.promptVersion},${review.lang},${JSON.stringify(review.preferences)}::jsonb,${JSON.stringify(review.coaching)}::jsonb,${review.latencyMs},${review.inputTokens ?? null},${review.outputTokens ?? null})`,
    );
    return id;
  }

  async reviews(ownerId: string, limit = 50): Promise<ReviewRecord[]> {
    const r = await this.db.execute(
      sql`select r.id,r.analysis_id,r.steam_id,r.provider,r.model,r.prompt_version,r.coaching,r.rating,r.latency_ms,r.created_at,j.filename from coach_reviews r join demo_jobs j on j.id=r.analysis_id where r.owner_id=${ownerId} order by r.created_at desc limit ${limit}`,
    );
    return r.rows.map((row) => ({
      id: row.id as string,
      analysisId: row.analysis_id as string,
      filename: row.filename as string,
      steamId: row.steam_id as string,
      provider: row.provider as string,
      model: row.model as string,
      promptVersion: row.prompt_version as string,
      coaching: row.coaching as { summary?: string; plan?: string[] },
      rating: (row.rating as number | null) ?? null,
      latencyMs: row.latency_ms as number,
      createdAt: isoDate(row.created_at),
    }));
  }

  async rateReview(
    ownerId: string,
    id: string,
    rating: number,
  ): Promise<boolean> {
    const r = await this.db.execute(
      sql`update coach_reviews set rating=${rating} where id=${id} and owner_id=${ownerId} returning id`,
    );
    return r.rows.length > 0;
  }

  async saveLiveCall(call: NewLiveCall): Promise<string> {
    const id = randomUUID();
    await this.db.execute(
      sql`insert into coach_live_calls(id,owner_id,session_id,round,call,provider,model,prompt_version,latency_ms) values(${id},${call.ownerId},${call.sessionId},${call.round},${JSON.stringify(call.call)}::jsonb,${call.provider},${call.model},${call.promptVersion},${call.latencyMs})`,
    );
    return id;
  }

  async liveCalls(ownerId: string, limit = 30): Promise<LiveCallRecord[]> {
    const r = await this.db.execute(
      sql`select id,session_id,round,call,model,created_at from coach_live_calls where owner_id=${ownerId} order by created_at desc limit ${limit}`,
    );
    return r.rows.map((row) => ({
      id: row.id as string,
      sessionId: (row.session_id as string | null) ?? null,
      round: (row.round as number | null) ?? null,
      call: row.call,
      model: row.model as string,
      createdAt: isoDate(row.created_at),
    }));
  }
}
