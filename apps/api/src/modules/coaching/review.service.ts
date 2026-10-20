import { analysisSchema, type Analysis } from "@cs2/contracts";
import {
  computeDeep,
  fairAnalysis,
  flaggedOpponents,
  integrityOf,
  type DeepResult,
} from "@cs2/coaching";
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
  CoachingCredits,
  CoachingFeatures,
  CoachingQuota,
  DeepReplaySource,
} from "./coaching.ports.js";
import type { CoachingRepository } from "./coaching.repository.js";
import type { PersonalizationService } from "./personalization.service.js";
import type { ViewerPolicy } from "./viewer.policy.js";
import { NO_REVIEW_AI, type ReviewAi } from "./review-ai.policy.js";

/** training: the practice plan of a match/player (`review` = the coaching just produced). */
export interface ReviewTraining {
  attach(
    ownerId: string,
    analysisId: string,
    steamId: string,
    review?: unknown,
  ): Promise<Record<string, unknown>>;
}
/** Previous deep reviews on the same map fed to a Pro deep review. */
export const DEEP_HISTORY_MATCHES = 5;
export type ReviewTier = "quick" | "deep";
export type ReviewDependencies = {
  coaching: CoachingRepository;
  history: AnalysisHistory;
  personalization: PersonalizationService;
  quota: CoachingQuota;
  credits: CoachingCredits;
  features: CoachingFeatures;
  ai: AiAccess;
  gateway: AiGateway;
  replays: DeepReplaySource;
  logger: Logger;
  /** Verifier + prompt A/B (default: deterministic checks only, variant "a"). */
  reviewAi?: ReviewAi;
  /** Deterministic practice plan added to responses as `training` (never fails a review). */
  training?: ReviewTraining;
  /** Team reviews share the rating endpoint. */
  teamRatings?: {
    rate(ownerId: string, id: string, rating: number): Promise<boolean>;
  };
};

/**
 * AI player reviews (POST /v1/analyses/:id/coaching), quick or deep. The daily safety cap and
 * the tier's credits are reserved before the model call and released on any failure; credits
 * are committed (ledger spend, ref = review id) only after the review is saved.
 */
export class ReviewService {
  constructor(private readonly deps: ReviewDependencies) {}

  async review(
    ownerId: string,
    analysisId: string,
    steamId: string,
    lang: CoachLanguage,
    viewer: ViewerPolicy,
    tier: ReviewTier = "quick",
  ): Promise<Record<string, unknown>> {
    const { coaching, history, quota, credits, ai, gateway, logger } =
      this.deps;
    const stored = await history.analysis(ownerId, analysisId);
    if (!stored) throw new NotFoundError("Analysis not found");
    const parsed = analysisSchema.parse(stored.analysis);
    if (!parsed.players.some((p) => p.steamId === steamId))
      throw new NotFoundError("Player not found");
    // Deaths to unusual opponents (analysis.integrity) are never held against the player.
    const fair = fairAnalysis(
      parsed,
      steamId,
      flaggedOpponents(integrityOf(stored.analysis)),
    );
    const analysis = fair.analysis;
    const daily = await quota.reserveReview(ownerId);
    const hold = await credits
      .reserve(ownerId, tier)
      .catch(async (error: unknown) => {
        await daily.release();
        throw error;
      });
    const release = async () => {
      await hold.release();
      await daily.release();
    };
    const purpose = tier === "deep" ? "review_deep" : "review_quick";
    const reviewAi = this.deps.reviewAi ?? NO_REVIEW_AI;
    const config = await ai
      .acquire(ownerId, purpose)
      .catch(async (error: unknown) => {
        await release();
        throw error;
      });
    try {
      const personal = await this.deps.personalization.forPlayer(
        ownerId,
        steamId,
        analysisId,
        await this.deps.features.perMapLearning(ownerId),
      );
      const deep =
        tier === "deep"
          ? await this.deepModules(ownerId, analysisId, analysis, steamId)
          : undefined;
      const [verifier, variant] = await Promise.all([
        reviewAi.verifierConfig(),
        reviewAi.variant(ownerId, purpose),
      ]);
      const result = await gateway.review(analysis, config, {
        focusSteamId: steamId,
        lang,
        personal,
        tier,
        ...(deep ? { deep } : {}),
        ...(fair.excluded.length
          ? { fair: { excluded: fair.excluded, rounds: [...fair.rounds] } }
          : {}),
        verify: verifier ? { config: verifier } : {},
        variant,
      });
      const { call } = result;
      const reviewId = await coaching.saveReview({
        ownerId,
        analysisId,
        steamId,
        tier,
        variant,
        creditsSpent: hold.cost,
        provider: call.provider,
        model: call.model,
        promptVersion: result.coaching.provenance?.promptVersion ?? "unknown",
        lang,
        preferences: personal.preferences,
        coaching: result.coaching,
        latencyMs: call.latencyMs,
        ...(call.usage?.inputTokens !== undefined
          ? { inputTokens: call.usage.inputTokens }
          : {}),
        ...(call.usage?.outputTokens !== undefined
          ? { outputTokens: call.usage.outputTokens }
          : {}),
      });
      const creditsSpent = await hold.commit(reviewId);
      logger.info(
        {
          provider: call.provider,
          model: call.model,
          latencyMs: call.latencyMs,
          usage: call.usage,
          tier,
          creditsSpent,
        },
        "ai player review",
      );
      return {
        reviewId,
        steamId,
        tier,
        creditsSpent,
        balance: await credits.balance(ownerId),
        call: viewer.callMeta(call),
        coaching: viewer.coaching(result.coaching),
        personalization: {
          preferences: personal.preferences,
          learnedFromMatches: personal.history?.matches ?? 0,
          previousPlans: personal.previousPlans?.length ?? 0,
        },
        ...(await this.deps.training?.attach(
          ownerId,
          analysisId,
          steamId,
          result.coaching,
        )),
      };
    } catch (error) {
      await release();
      throw aiRequestError(error, viewer.admin, logger);
    }
  }

  /** Deterministic deep modules (+ Pro history on the same map). */
  private async deepModules(
    ownerId: string,
    analysisId: string,
    analysis: Analysis,
    steamId: string,
  ): Promise<DeepResult> {
    const replay = await this.deps.replays.read(analysisId);
    const previous =
      analysis.map && (await this.deps.features.deepHistory(ownerId))
        ? await this.deps.coaching.previousDeep(
            ownerId,
            steamId,
            analysis.map,
            analysisId,
            DEEP_HISTORY_MATCHES,
          )
        : [];
    return computeDeep(analysis, steamId, replay, previous);
  }

  /** GET /v1/analyses/:id/reviews: saved reviews of the match/player per tier (no cost). */
  async matchReviews(
    ownerId: string,
    analysisId: string,
    steamId: string,
    viewer: ViewerPolicy,
  ): Promise<Record<string, unknown>> {
    if (!(await this.deps.history.analysis(ownerId, analysisId)))
      throw new NotFoundError("Analysis not found");
    const reviews = await this.deps.coaching.matchReviews(
      ownerId,
      analysisId,
      steamId,
    );
    const latest = (tier: ReviewTier) =>
      reviews.find((r) => r.tier === tier)?.id ?? null;
    return {
      analysisId,
      steamId,
      latest: { quick: latest("quick"), deep: latest("deep") },
      reviews: reviews.map((r) => ({
        reviewId: r.id,
        tier: r.tier,
        createdAt: r.createdAt,
        creditsSpent: r.creditsSpent,
        promptVersion: r.promptVersion,
        lang: r.lang,
        rating: r.rating,
        ...(viewer.admin ? { provider: r.provider, model: r.model } : {}),
        coaching: viewer.coaching(r.coaching),
      })),
      ...(await this.deps.training?.attach(
        ownerId,
        analysisId,
        steamId,
        reviews[0]?.coaching,
      )),
    };
  }

  async rate(
    ownerId: string,
    reviewId: string,
    rating: number,
  ): Promise<{ ok: true }> {
    if (
      !(await this.deps.coaching.rateReview(ownerId, reviewId, rating)) &&
      !(await this.deps.teamRatings?.rate(ownerId, reviewId, rating))
    )
      throw new NotFoundError("Review not found");
    return { ok: true };
  }
}
