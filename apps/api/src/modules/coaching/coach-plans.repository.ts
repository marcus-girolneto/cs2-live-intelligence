import { sql } from "drizzle-orm";
import type { PreviousPlan, PlanItem } from "@cs2/coaching";
import type { Db } from "../../shared/db/database.js";
import { uuidOrNull } from "../../shared/db/rows.js";

/** A stored review's plan with the map of the analysed match. */
export type ReviewPlanRecord = {
  reviewId: string;
  analysisId: string;
  steamId: string;
  map: string | null;
  createdAt: string;
  items: PlanItem[];
};

export interface CoachPlansRepository {
  /** Newest-first plans the player received on other matches (any map). */
  previousPlans(
    ownerId: string,
    steamId: string,
    excludeAnalysisId: string,
    limit?: number,
  ): Promise<PreviousPlan[]>;
  /** Newest-first plans of every review for one player. */
  reviewPlans(ownerId: string, steamId: string): Promise<ReviewPlanRecord[]>;
}

/**
 * v5 reviews store planItems with a scope; legacy reviews only have plan strings, which are
 * treated as map items of the match they were written for (never fed to other maps).
 */
export function planItemsOf(coaching: unknown, map: string | null): PlanItem[] {
  const c = (coaching ?? {}) as { plan?: unknown; planItems?: unknown };
  if (Array.isArray(c.planItems))
    return c.planItems
      .filter(
        (p): p is PlanItem =>
          typeof p === "object" &&
          p !== null &&
          typeof (p as PlanItem).text === "string" &&
          ((p as PlanItem).scope === "map" ||
            (p as PlanItem).scope === "general"),
      )
      .map((p) =>
        p.scope === "map"
          ? {
              text: p.text,
              scope: "map" as const,
              ...((p.map ?? map) ? { map: p.map ?? map! } : {}),
            }
          : { text: p.text, scope: "general" as const },
      );
  return (Array.isArray(c.plan) ? c.plan : [])
    .filter((p): p is string => typeof p === "string" && !!p.trim())
    .map((text) => ({ text, scope: "map" as const, ...(map ? { map } : {}) }));
}

export class PgCoachPlansRepository implements CoachPlansRepository {
  constructor(private readonly db: Db) {}
  async previousPlans(
    ownerId: string,
    steamId: string,
    excludeAnalysisId: string,
    limit = 6,
  ): Promise<PreviousPlan[]> {
    const r = await this.db.execute(
      sql`select r.payload,r.created_at,m.map from ai_reviews r join uploads x on x.id=r.upload_id left join matches m on m.id=x.match_id where r.owner_id=${ownerId} and r.steam_id=${steamId} and r.kind in ('quick','deep') and (${uuidOrNull(excludeAnalysisId)}::uuid is null or r.upload_id<>${uuidOrNull(excludeAnalysisId)}) order by r.created_at desc limit ${limit}`,
    );
    return r.rows
      .map((row) => {
        const map = (row.map as string | null) ?? null;
        return {
          date: new Date(row.created_at as string).toISOString().slice(0, 10),
          map,
          items: planItemsOf(row.payload, map),
        };
      })
      .filter((p) => p.items.length > 0);
  }
  async reviewPlans(
    ownerId: string,
    steamId: string,
  ): Promise<ReviewPlanRecord[]> {
    const r = await this.db.execute(
      sql`select r.id,r.upload_id,r.steam_id,r.payload,r.created_at,m.map from ai_reviews r join uploads x on x.id=r.upload_id left join matches m on m.id=x.match_id where r.owner_id=${ownerId} and r.steam_id=${steamId} and r.kind in ('quick','deep') order by r.created_at desc limit 200`,
    );
    return r.rows.map((row) => {
      const map = (row.map as string | null) ?? null;
      return {
        reviewId: row.id as string,
        analysisId: row.upload_id as string,
        steamId: row.steam_id as string,
        map,
        createdAt: new Date(row.created_at as string).toISOString(),
        items: planItemsOf(row.payload, map),
      };
    });
  }
}
