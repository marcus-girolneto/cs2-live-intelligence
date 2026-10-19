import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";
import { isoDate } from "../../shared/db/rows.js";

export type NewTeamReview = {
  ownerId: string;
  analysisId: string;
  steamId: string;
  provider: string;
  model: string;
  promptVersion: string;
  variant: "a" | "b";
  lang: string;
  review: unknown;
  creditsSpent: number;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
};
export type TeamReviewRecord = {
  id: string;
  steamId: string;
  provider: string;
  model: string;
  promptVersion: string;
  lang: string;
  review: unknown;
  rating: number | null;
  creditsSpent: number;
  createdAt: string;
};

/** Stored team reviews (one AI call per team review). */
export interface TeamReviewRepository {
  save(review: NewTeamReview): Promise<string>;
  /** Team reviews of a match that include `steamId` (requester or member), newest first. */
  forMatch(
    ownerId: string,
    analysisId: string,
    steamId: string,
  ): Promise<TeamReviewRecord[]>;
  rate(ownerId: string, id: string, rating: number): Promise<boolean>;
}

export class PgTeamReviewRepository implements TeamReviewRepository {
  constructor(private readonly db: Db) {}

  async save(r: NewTeamReview): Promise<string> {
    const id = randomUUID();
    await this.db.execute(
      sql`insert into team_reviews(id,owner_id,analysis_id,steam_id,provider,model,prompt_version,variant,lang,review,credits_spent,latency_ms,input_tokens,output_tokens) values(${id},${r.ownerId},${r.analysisId},${r.steamId},${r.provider},${r.model},${r.promptVersion},${r.variant},${r.lang},${JSON.stringify(r.review)}::jsonb,${r.creditsSpent},${r.latencyMs},${r.inputTokens ?? null},${r.outputTokens ?? null})`,
    );
    return id;
  }

  async forMatch(
    ownerId: string,
    analysisId: string,
    steamId: string,
  ): Promise<TeamReviewRecord[]> {
    const r = await this.db.execute(
      sql`select id,steam_id,provider,model,prompt_version,lang,review,rating,credits_spent,created_at from team_reviews where owner_id=${ownerId} and analysis_id=${analysisId} and (steam_id=${steamId} or review->'members' ? ${steamId}) order by created_at desc limit 20`,
    );
    return r.rows.map((row) => ({
      id: row.id as string,
      steamId: row.steam_id as string,
      provider: row.provider as string,
      model: row.model as string,
      promptVersion: row.prompt_version as string,
      lang: row.lang as string,
      review: row.review,
      rating: (row.rating as number | null) ?? null,
      creditsSpent: Number(row.credits_spent),
      createdAt: isoDate(row.created_at),
    }));
  }

  async rate(ownerId: string, id: string, rating: number): Promise<boolean> {
    const r = await this.db.execute(
      sql`update team_reviews set rating=${rating} where id=${id} and owner_id=${ownerId} returning id`,
    );
    return r.rows.length > 0;
  }
}
