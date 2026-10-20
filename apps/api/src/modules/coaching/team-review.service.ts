import {
  analysisSchema,
  teamReviewSchema,
  type LobbyComparison,
} from "@cs2/contracts";
import { integrityOf, lobbyComparison, nameTeamReview } from "@cs2/coaching";
import type {
  CoachLanguage,
  TeamAiGateway,
} from "../../infrastructure/ai/coaching-ai-gateway.js";
import { NotFoundError } from "../../shared/errors/index.js";
import type { Logger } from "../../shared/logging/logger.js";
import { aiRequestError } from "../ai-config/ai-errors.js";
import type {
  AiAccess,
  AnalysisHistory,
  CoachingCredits,
  CoachingQuota,
} from "./coaching.ports.js";
import { NO_REVIEW_AI, type ReviewAi } from "./review-ai.policy.js";
import type { TeamReviewRepository } from "./team-review.repository.js";
import type { ViewerPolicy } from "./viewer.policy.js";

export type TeamReviewDependencies = {
  reviews: TeamReviewRepository;
  history: AnalysisHistory;
  quota: CoachingQuota;
  credits: CoachingCredits;
  ai: AiAccess;
  gateway: TeamAiGateway;
  reviewAi?: ReviewAi;
  logger: Logger;
};

/**
 * Team reviews (POST /v1/analyses/:id/team-review): one AI call covering the requesting
 * player's team. Same money path as player reviews: the shared daily safety cap and the team
 * cost are reserved first, released on any failure, committed after the review is saved.
 * Also the free deterministic lobby comparison.
 */
export class TeamReviewService {
  constructor(private readonly deps: TeamReviewDependencies) {}

  private async load(ownerId: string, analysisId: string, steamId: string) {
    const stored = await this.deps.history.analysis(ownerId, analysisId);
    if (!stored) throw new NotFoundError("Analysis not found");
    const analysis = analysisSchema.parse(stored.analysis);
    if (!analysis.players.some((p) => p.steamId === steamId))
      throw new NotFoundError("Player not found");
    return { analysis, integrity: integrityOf(stored.analysis) };
  }

  async review(
    ownerId: string,
    analysisId: string,
    steamId: string,
    lang: CoachLanguage,
    viewer: ViewerPolicy,
  ): Promise<Record<string, unknown>> {
    const { reviews, quota, credits, ai, gateway, logger } = this.deps;
    const { analysis, integrity } = await this.load(
      ownerId,
      analysisId,
      steamId,
    );
    const daily = await quota.reserveReview(ownerId);
    const hold = await credits
      .reserve(ownerId, "team")
      .catch(async (error: unknown) => {
        await daily.release();
        throw error;
      });
    const release = async () => {
      await hold.release();
      await daily.release();
    };
    const config = await ai
      .acquire(ownerId, "review_team")
      .catch(async (error: unknown) => {
        await release();
        throw error;
      });
    try {
      const reviewAi = this.deps.reviewAi ?? NO_REVIEW_AI;
      const [verifier, variant] = await Promise.all([
        reviewAi.verifierConfig(),
        reviewAi.variant(ownerId, "review_team"),
      ]);
      const result = await gateway.teamReview(analysis, config, {
        steamId,
        lang,
        integrity,
        verify: verifier ? { config: verifier } : {},
        variant,
      });
      const { call } = result;
      const reviewId = await reviews.save({
        ownerId,
        analysisId,
        steamId,
        provider: call.provider,
        model: call.model,
        promptVersion: result.review.provenance?.promptVersion ?? "unknown",
        variant,
        lang,
        review: result.review,
        creditsSpent: hold.cost,
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
          creditsSpent,
          verification: result.review.provenance?.verification,
        },
        "ai team review",
      );
      return {
        reviewId,
        creditsSpent,
        balance: await credits.balance(ownerId),
        call: viewer.callMeta(call),
        teamReview: viewer.coaching(result.review),
      };
    } catch (error) {
      await release();
      throw aiRequestError(error, viewer.admin);
    }
  }

  /** GET /v1/analyses/:id/team-reviews?steamId= (saved, free to reopen). */
  async list(
    ownerId: string,
    analysisId: string,
    steamId: string,
    viewer: ViewerPolicy,
  ): Promise<Record<string, unknown>> {
    const stored = await this.deps.history.analysis(ownerId, analysisId);
    if (!stored) throw new NotFoundError("Analysis not found");
    const players = analysisSchema.safeParse(stored.analysis);
    const rows = await this.deps.reviews.forMatch(ownerId, analysisId, steamId);
    return {
      analysisId,
      steamId,
      reviews: rows.map((r) => ({
        reviewId: r.id,
        steamId: r.steamId,
        createdAt: r.createdAt,
        creditsSpent: r.creditsSpent,
        promptVersion: r.promptVersion,
        lang: r.lang,
        rating: r.rating,
        ...(viewer.admin ? { provider: r.provider, model: r.model } : {}),
        teamReview: viewer.coaching(
          withNames(
            r.review,
            players.success ? players.data.players : [],
            r.lang,
          ),
        ),
      })),
    };
  }

  /** GET /v1/analyses/:id/lobby?steamId= (deterministic, free). */
  async lobby(
    ownerId: string,
    analysisId: string,
    steamId: string,
  ): Promise<LobbyComparison & { analysisId: string }> {
    const { analysis } = await this.load(ownerId, analysisId, steamId);
    return { analysisId, ...lobbyComparison(analysis, steamId) };
  }

  /** Ratings of team reviews go through POST /v1/coach/reviews/:id/rating too. */
  rate(ownerId: string, id: string, rating: number): Promise<boolean> {
    return this.deps.reviews.rate(ownerId, id, rating);
  }
}

/** Reviews saved before names were mapped back still carry P1-P5: map them on read. */
function withNames(
  review: unknown,
  players: Parameters<typeof nameTeamReview>[1],
  lang: string,
): unknown {
  const parsed = teamReviewSchema.safeParse(review);
  return parsed.success
    ? { ...(review as object), ...nameTeamReview(parsed.data, players, lang) }
    : review;
}
