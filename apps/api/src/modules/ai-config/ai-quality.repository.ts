import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";
import { isoDate } from "../../shared/db/rows.js";

/** GET /v1/admin/ai/ratings item. */
export type RatingRowDto = {
  purpose: "review_quick" | "review_deep" | "review_team";
  variant: "a" | "b";
  promptVersion: string;
  reviews: number;
  rated: number;
  avgRating: number | null;
};

/** Ratings per purpose/variant/prompt and the stored AI eval summaries. */
export interface AiQualityRepository {
  ratings(): Promise<RatingRowDto[]>;
  saveEval(summary: unknown): Promise<string>;
  latestEval(): Promise<
    { id: string; createdAt: string; summary: unknown } | undefined
  >;
}

export class PgAiQualityRepository implements AiQualityRepository {
  constructor(private readonly db: Db) {}

  async ratings(): Promise<RatingRowDto[]> {
    const r = await this.db.execute(
      sql`select 'review_'||kind as purpose,variant,prompt_version,count(*)::int as reviews,count(rating)::int as rated,avg(rating)::float as avg_rating from ai_reviews group by kind,variant,prompt_version order by purpose,variant,prompt_version`,
    );
    return r.rows.map((row) => ({
      purpose: row.purpose as RatingRowDto["purpose"],
      variant: row.variant === "b" ? "b" : "a",
      promptVersion: row.prompt_version as string,
      reviews: Number(row.reviews),
      rated: Number(row.rated),
      avgRating:
        row.avg_rating === null
          ? null
          : Math.round(Number(row.avg_rating) * 100) / 100,
    }));
  }

  async saveEval(summary: unknown): Promise<string> {
    const id = randomUUID();
    await this.db.execute(
      sql`insert into ai_eval_reports(id,summary) values(${id},${JSON.stringify(summary)}::jsonb)`,
    );
    return id;
  }

  async latestEval(): Promise<
    { id: string; createdAt: string; summary: unknown } | undefined
  > {
    const r = await this.db.execute(
      sql`select id,summary,created_at from ai_eval_reports order by created_at desc limit 1`,
    );
    const row = r.rows[0];
    return row
      ? {
          id: row.id as string,
          createdAt: isoDate(row.created_at),
          summary: row.summary,
        }
      : undefined;
  }
}
