import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { PersonalCoachPlan } from "@cs2/contracts";
import type { Db } from "../../shared/db/database.js";
import { isoDate, isoOrNull } from "../../shared/db/rows.js";

export type NewCoachPlan = {
  ownerId: string;
  steamId: string;
  lang: string;
  trigger: "manual" | "auto";
  plan: PersonalCoachPlan;
  lastAnalysisAt: string | null;
  provider: string;
  model: string;
  promptVersion: string;
  /** The service clock (cooldowns are measured against it). */
  createdAt: string;
};
export type CoachPlanRecord = {
  id: string;
  lang: string;
  trigger: "manual" | "auto";
  plan: PersonalCoachPlan;
  basedOnMatches: number;
  lastAnalysisAt: string | null;
  provider: string;
  model: string;
  createdAt: string;
};

/** Stored Personal Coach plans (newest first). */
export interface PersonalCoachRepository {
  save(plan: NewCoachPlan): Promise<string>;
  history(ownerId: string, limit: number): Promise<CoachPlanRecord[]>;
}

export class PgPersonalCoachRepository implements PersonalCoachRepository {
  constructor(private readonly db: Db) {}

  async save(p: NewCoachPlan): Promise<string> {
    const id = randomUUID();
    await this.db.execute(
      sql`insert into personal_coach_plans(id,owner_id,steam_id,lang,trigger,plan,based_on_matches,last_analysis_at,provider,model,prompt_version,created_at) values(${id},${p.ownerId},${p.steamId},${p.lang},${p.trigger},${JSON.stringify(p.plan)}::jsonb,${p.plan.basedOnMatches},${p.lastAnalysisAt}::timestamptz,${p.provider},${p.model},${p.promptVersion},${p.createdAt}::timestamptz)`,
    );
    return id;
  }

  async history(ownerId: string, limit: number): Promise<CoachPlanRecord[]> {
    const r = await this.db.execute(
      sql`select id,lang,trigger,plan,based_on_matches,last_analysis_at,provider,model,created_at from personal_coach_plans where owner_id=${ownerId} order by created_at desc limit ${limit}`,
    );
    return r.rows.map((row) => ({
      id: row.id as string,
      lang: row.lang as string,
      trigger: row.trigger === "auto" ? "auto" : "manual",
      plan: row.plan as PersonalCoachPlan,
      basedOnMatches: Number(row.based_on_matches),
      lastAnalysisAt: isoOrNull(row.last_analysis_at),
      provider: row.provider as string,
      model: row.model as string,
      createdAt: isoDate(row.created_at),
    }));
  }
}
