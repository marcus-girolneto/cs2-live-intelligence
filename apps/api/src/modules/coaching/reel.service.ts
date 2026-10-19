import { analysisSchema } from "@cs2/contracts";
import { matchReel, type MatchReel } from "@cs2/coaching";
import { NotFoundError, PlanFeatureError } from "../../shared/errors/index.js";
import type { AnalysisHistory, CoachingFeatures } from "./coaching.ports.js";

/** GET /v1/analyses/:id/reel: the Pro full-match highlight + mistake reel (no AI, no credits). */
export class ReelService {
  constructor(
    private readonly history: AnalysisHistory,
    private readonly features: CoachingFeatures,
  ) {}

  async reel(
    ownerId: string,
    analysisId: string,
    steamId: string,
  ): Promise<MatchReel & { analysisId: string }> {
    if (!(await this.features.reel(ownerId)))
      throw new PlanFeatureError(
        "reel",
        "pro",
        "The full-match reel is included in the Pro plan.",
      );
    const stored = await this.history.analysis(ownerId, analysisId);
    if (!stored) throw new NotFoundError("Analysis not found");
    const analysis = analysisSchema.parse(stored.analysis);
    if (!analysis.players.some((p) => p.steamId === steamId))
      throw new NotFoundError("Player not found");
    return { analysisId, ...matchReel(analysis, steamId) };
  }
}
