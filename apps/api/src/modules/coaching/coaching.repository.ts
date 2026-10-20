import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";
import { isoDate, uuidOrNull } from "../../shared/db/rows.js";
import type {
  CoachProfileRecord,
  LiveCallRecord,
  NewLiveCall,
  MatchReviewRecord,
  NewReview,
  ReviewRecord,
} from "./coaching.dto.js";
import type { DeepReview } from "@cs2/contracts";

/**
 * Coach profile, stored AI player reviews (ai_reviews kind quick/deep, with ratings) and live
 * calls. `analysisId` is the upload id.
 */
export interface CoachingRepository {
  profile(ownerId: string): Promise<CoachProfileRecord>;
  saveProfile(
    ownerId: string,
    preferences: unknown,
    playerSteamId: string | null,
  ): Promise<void>;
  saveReview(review: NewReview): Promise<string>;
  /** Saved reviews of one match and player, newest first. */
  matchReviews(
    ownerId: string,
    analysisId: string,
    steamId: string,
  ): Promise<MatchReviewRecord[]>;
  /** Deep reviews of the player created in [from, to) (monthly reports). */
  deepReviewsBetween(
    ownerId: string,
    steamId: string,
    from: string,
    to: string,
  ): Promise<{ analysisId: string; createdAt: string; deep: DeepReview }[]>;
  /** coaching.deep of earlier deep reviews of the player on `map` (newest first). */
  previousDeep(
    ownerId: string,
    steamId: string,
    map: string,
    excludeAnalysisId: string,
    limit: number,
  ): Promise<DeepReview[]>;
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
    const payload = JSON.stringify(review.coaching);
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`insert into ai_reviews(id,owner_id,upload_id,steam_id,kind,provider,model,prompt_version,variant,lang,preferences,payload,credits_spent,latency_ms,input_tokens,output_tokens) values(${id},${review.ownerId},${review.analysisId},${review.steamId},${review.tier},${review.provider},${review.model},${review.promptVersion},${review.variant ?? "a"},${review.lang},${JSON.stringify(review.preferences)}::jsonb,${payload}::jsonb,${review.creditsSpent},${review.latencyMs},${review.inputTokens ?? null},${review.outputTokens ?? null})`,
      );
      // Deep modules measure crosshair placement and positioning: keep them on the player's
      // match row for indexed progress queries.
      if (review.tier === "deep")
        await tx.execute(
          sql`update match_players p set crosshair_median_deg=coalesce((${payload}::jsonb->'deep'->'crosshair'->>'medianOffset')::real,p.crosshair_median_deg),isolated_deaths_pct=coalesce((${payload}::jsonb->'deep'->'positioning'->>'isolatedPct')::real,p.isolated_deaths_pct) from uploads u where u.id=${review.analysisId} and p.match_id=u.match_id and p.steam_id=${review.steamId}`,
        );
    });
    return id;
  }

  async matchReviews(
    ownerId: string,
    analysisId: string,
    steamId: string,
  ): Promise<MatchReviewRecord[]> {
    const r = await this.db.execute(
      sql`select id,kind,provider,model,prompt_version,lang,payload,rating,credits_spent,created_at from ai_reviews where upload_id=${uuidOrNull(analysisId)} and owner_id=${ownerId} and steam_id=${steamId} and kind in ('quick','deep') order by created_at desc limit 20`,
    );
    return r.rows.map((row) => ({
      id: row.id as string,
      tier: row.kind === "deep" ? "deep" : "quick",
      provider: row.provider as string,
      model: row.model as string,
      promptVersion: row.prompt_version as string,
      lang: row.lang as string,
      coaching: row.payload,
      rating: (row.rating as number | null) ?? null,
      creditsSpent: Number(row.credits_spent),
      createdAt: isoDate(row.created_at),
    }));
  }

  async deepReviewsBetween(
    ownerId: string,
    steamId: string,
    from: string,
    to: string,
  ): Promise<{ analysisId: string; createdAt: string; deep: DeepReview }[]> {
    const r = await this.db.execute(
      sql`select upload_id,created_at,payload->'deep' as deep from ai_reviews where owner_id=${ownerId} and steam_id=${steamId} and kind='deep' and payload ? 'deep' and created_at>=${from}::timestamptz and created_at<${to}::timestamptz order by created_at limit 200`,
    );
    return r.rows.map((row) => ({
      analysisId: row.upload_id as string,
      createdAt: isoDate(row.created_at),
      deep: row.deep as DeepReview,
    }));
  }

  async previousDeep(
    ownerId: string,
    steamId: string,
    map: string,
    excludeAnalysisId: string,
    limit: number,
  ): Promise<DeepReview[]> {
    const r = await this.db.execute(
      sql`select distinct on (upload_id) upload_id,payload->'deep' as deep,created_at from ai_reviews where owner_id=${ownerId} and steam_id=${steamId} and kind='deep' and payload->>'map'=${map} and (${uuidOrNull(excludeAnalysisId)}::uuid is null or upload_id<>${uuidOrNull(excludeAnalysisId)}) and payload ? 'deep' order by upload_id,created_at desc`,
    );
    return r.rows
      .sort(
        (a, b) =>
          new Date(b.created_at as string).getTime() -
          new Date(a.created_at as string).getTime(),
      )
      .slice(0, limit)
      .map((row) => row.deep as DeepReview);
  }

  async reviews(ownerId: string, limit = 50): Promise<ReviewRecord[]> {
    const r = await this.db.execute(
      sql`select r.id,r.upload_id,r.steam_id,r.provider,r.model,r.prompt_version,r.payload,r.rating,r.latency_ms,r.created_at,r.kind,x.filename from ai_reviews r join uploads x on x.id=r.upload_id where r.owner_id=${ownerId} and r.kind in ('quick','deep') order by r.created_at desc limit ${limit}`,
    );
    return r.rows.map((row) => ({
      id: row.id as string,
      analysisId: row.upload_id as string,
      filename: row.filename as string,
      steamId: row.steam_id as string,
      provider: row.provider as string,
      model: row.model as string,
      promptVersion: row.prompt_version as string,
      coaching: row.payload as { summary?: string; plan?: string[] },
      rating: (row.rating as number | null) ?? null,
      latencyMs: row.latency_ms as number,
      createdAt: isoDate(row.created_at),
      tier: row.kind === "deep" ? ("deep" as const) : ("quick" as const),
    }));
  }

  async rateReview(
    ownerId: string,
    id: string,
    rating: number,
  ): Promise<boolean> {
    const r = await this.db.execute(
      sql`update ai_reviews set rating=${rating} where id=${uuidOrNull(id)} and owner_id=${ownerId} and kind in ('quick','deep') returning id`,
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
