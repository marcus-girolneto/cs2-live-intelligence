import { analysisSchema } from "@cs2/contracts";
import type {
  AiGateway,
  CoachLanguage,
} from "../../infrastructure/ai/coaching-ai-gateway.js";
import { NotFoundError } from "../../shared/errors/index.js";
import type { Logger } from "../../shared/logging/logger.js";
import { aiRequestError } from "../ai-config/ai-errors.js";
import type {
  AiAccess,
  AnalysisHistory,
  CoachingFeatures,
  CoachingQuota,
} from "./coaching.ports.js";
import type { CoachingRepository } from "./coaching.repository.js";
import type { PersonalizationService } from "./personalization.service.js";
import type { ViewerPolicy } from "./viewer.policy.js";

/**
 * AI player reviews (POST /v1/analyses/:id/coaching). The plan quota is reserved before the
 * model call and given back on any failure, so only successful reviews count (a
 * reserve/confirm/release sequence instead of a transaction held open across a slow call).
 */
export class ReviewService {
  constructor(
    private readonly coaching: CoachingRepository,
    private readonly history: AnalysisHistory,
    private readonly personalization: PersonalizationService,
    private readonly quota: CoachingQuota,
    private readonly features: CoachingFeatures,
    private readonly ai: AiAccess,
    private readonly gateway: AiGateway,
    private readonly logger: Logger,
  ) {}

  async review(
    ownerId: string,
    analysisId: string,
    steamId: string,
    lang: CoachLanguage,
    viewer: ViewerPolicy,
  ): Promise<Record<string, unknown>> {
    const stored = await this.history.analysis(ownerId, analysisId);
    if (!stored) throw new NotFoundError("Analysis not found");
    const analysis = analysisSchema.parse(stored.analysis);
    if (!analysis.players.some((p) => p.steamId === steamId))
      throw new NotFoundError("Player not found");
    const reserved = await this.quota.reserveReview(ownerId);
    const config = await this.ai
      .acquire(ownerId, "review")
      .catch(async (error: unknown) => {
        await reserved.release();
        throw error;
      });
    try {
      const personal = await this.personalization.forPlayer(
        ownerId,
        steamId,
        analysisId,
        await this.features.perMapLearning(ownerId),
      );
      const { coaching, call } = await this.gateway.review(analysis, config, {
        focusSteamId: steamId,
        lang,
        personal,
      });
      const reviewId = await this.coaching.saveReview({
        ownerId,
        analysisId,
        steamId,
        provider: call.provider,
        model: call.model,
        promptVersion: coaching.provenance?.promptVersion ?? "unknown",
        lang,
        preferences: personal.preferences,
        coaching,
        latencyMs: call.latencyMs,
        ...(call.usage?.inputTokens !== undefined
          ? { inputTokens: call.usage.inputTokens }
          : {}),
        ...(call.usage?.outputTokens !== undefined
          ? { outputTokens: call.usage.outputTokens }
          : {}),
      });
      this.logger.info(
        {
          provider: call.provider,
          model: call.model,
          latencyMs: call.latencyMs,
          usage: call.usage,
        },
        "ai player review",
      );
      return {
        reviewId,
        steamId,
        call: viewer.callMeta(call),
        coaching: viewer.coaching(coaching),
        personalization: {
          preferences: personal.preferences,
          learnedFromMatches: personal.history?.matches ?? 0,
          previousPlans: personal.previousPlans?.length ?? 0,
        },
      };
    } catch (error) {
      await reserved.release();
      throw aiRequestError(error, viewer.admin);
    }
  }

  async rate(
    ownerId: string,
    reviewId: string,
    rating: number,
  ): Promise<{ ok: true }> {
    if (!(await this.coaching.rateReview(ownerId, reviewId, rating)))
      throw new NotFoundError("Review not found");
    return { ok: true };
  }
}
