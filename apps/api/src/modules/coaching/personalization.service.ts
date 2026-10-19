import { analysisSchema, type Analysis } from "@cs2/contracts";
import {
  learnProfile,
  parsePreferences,
  type Personalization,
} from "@cs2/coaching";
import type { CoachPlansService } from "./coach-plans.service.js";
import type { AnalysisHistory } from "./coaching.ports.js";
import type { CoachingRepository } from "./coaching.repository.js";

export type ParsedAnalysis = {
  id: string;
  filename: string;
  createdAt: string;
  analysis: Analysis;
};

/** Completed analyses that still satisfy the analysis contract (older shapes are skipped). */
export async function validAnalyses(
  history: AnalysisHistory,
  ownerId: string,
): Promise<ParsedAnalysis[]> {
  return (await history.completedAnalyses(ownerId))
    .map((a) => {
      const parsed = analysisSchema.safeParse(a.analysis);
      return parsed.success ? { ...a, analysis: parsed.data } : null;
    })
    .filter((a): a is ParsedAnalysis => a !== null);
}

/** Preferences, learned profile and previous plans for the player being coached. */
export class PersonalizationService {
  constructor(
    private readonly coaching: CoachingRepository,
    private readonly history: AnalysisHistory,
    private readonly plans: CoachPlansService,
  ) {}

  async preferences(ownerId: string): Promise<Personalization["preferences"]> {
    return parsePreferences((await this.coaching.profile(ownerId)).preferences);
  }

  async forPlayer(
    ownerId: string,
    steamId: string,
    excludeAnalysisId: string | null,
    perMapLearning = true,
  ): Promise<Personalization> {
    const preferences = await this.preferences(ownerId);
    const analyses = (await validAnalyses(this.history, ownerId))
      .filter((a) => a.id !== excludeAnalysisId)
      .map((a) => ({ analysis: a.analysis, createdAt: a.createdAt, id: a.id }));
    return {
      preferences,
      history: learnProfile(analyses, steamId),
      previousPlans: await this.plans.previousPlans(
        ownerId,
        steamId,
        excludeAnalysisId,
      ),
      perMapLearning,
    };
  }
}
