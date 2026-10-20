import { analysisSchema, type TrainingPlan } from "@cs2/contracts";
import {
  buildTrainingPlan,
  TRAINING_SKILLS,
  trainingCatalog,
  VERIFIED,
  weeklyPractice,
  type TrainingReview,
  type TrainingSkill,
} from "@cs2/coaching";
import { NotFoundError } from "../../shared/errors/index.js";
import type {
  AnalysisTrainingDto,
  RecommendedTrainingDto,
  TrainingCatalogDto,
} from "./training.dto.js";
import type {
  TrainingAnalyses,
  TrainingRecent,
  TrainingReplays,
  TrainingReviews,
} from "./training.ports.js";

/** Matches read for "Recommended for you" (documents are loaded, keep it small). */
export const RECOMMENDED_MATCHES = 3;

/**
 * Training layer (no AI): the verified practice catalog and, per match and player, the
 * deterministic plan built from the stored analysis, its replay and the newest review.
 */
export class TrainingService {
  constructor(
    private readonly deps: {
      analyses: TrainingAnalyses;
      replays: TrainingReplays;
      reviews: TrainingReviews;
      recent?: TrainingRecent;
    },
  ) {}

  catalog(): TrainingCatalogDto {
    return {
      verifiedAt: VERIFIED.verifiedAt,
      skills: [...TRAINING_SKILLS],
      entries: trainingCatalog(),
    };
  }

  /** The plan of one match/player; `review` overrides the stored newest review. */
  async plan(
    ownerId: string,
    analysisId: string,
    steamId: string,
    review?: TrainingReview,
  ): Promise<TrainingPlan> {
    const stored = await this.deps.analyses.analysis(ownerId, analysisId);
    if (!stored) throw new NotFoundError("Analysis not found");
    return this.build(stored.analysis, analysisId, ownerId, steamId, review);
  }

  private async build(
    document: unknown,
    analysisId: string,
    ownerId: string,
    steamId: string,
    review?: TrainingReview,
  ): Promise<TrainingPlan> {
    const analysis = analysisSchema.parse(document);
    if (!analysis.players.some((p) => p.steamId === steamId))
      throw new NotFoundError("Player not found");
    const [replay, stored] = await Promise.all([
      this.deps.replays.read(analysisId),
      review
        ? Promise.resolve(review)
        : this.deps.reviews.latest(ownerId, analysisId, steamId),
    ]);
    return buildTrainingPlan({
      analysis,
      steamId,
      ...(replay ? { replay } : {}),
      ...(stored ? { review: stored } : {}),
    });
  }

  async forAnalysis(
    ownerId: string,
    analysisId: string,
    steamId: string,
  ): Promise<AnalysisTrainingDto> {
    return {
      analysisId,
      steamId,
      training: await this.plan(ownerId, analysisId, steamId),
    };
  }

  /** "Recommended for you": the newest own match of the tracked player and a week layout. */
  async recommended(ownerId: string): Promise<RecommendedTrainingDto> {
    const steamId = await this.deps.reviews.playerSteamId(ownerId);
    const empty: RecommendedTrainingDto = {
      steamId,
      latest: null,
      focus: [],
      week: [],
      matches: 0,
    };
    if (!steamId || !this.deps.recent) return empty;
    const rows = await this.deps.recent.recent(ownerId, RECOMMENDED_MATCHES);
    const plans: { row: (typeof rows)[number]; plan: TrainingPlan }[] = [];
    for (const row of rows) {
      // A match without the tracked player (or unreadable) is skipped.
      const plan = await this.build(
        row.analysis,
        row.id,
        ownerId,
        steamId,
      ).catch(() => undefined);
      if (plan) plans.push({ row, plan });
    }
    const first = plans[0];
    if (!first) return empty;
    const votes = new Map<TrainingSkill, number>();
    plans.forEach(({ plan }, i) =>
      plan.focus.forEach((s, rank) =>
        votes.set(s, (votes.get(s) ?? 0) + (3 - rank) * (i === 0 ? 2 : 1)),
      ),
    );
    const focus = [...votes.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([s]) => s)
      .slice(0, 3);
    return {
      steamId,
      latest: {
        analysisId: first.row.id,
        createdAt: first.row.createdAt,
        map: first.plan.map ?? null,
        training: first.plan,
      },
      focus,
      week: weeklyPractice({
        focus,
        ...(first.plan.map ? { map: first.plan.map } : {}),
      }),
      matches: plans.length,
    };
  }

  /** Additive `training` field of review responses: never fails the review. */
  async attach(
    ownerId: string,
    analysisId: string,
    steamId: string,
    review?: unknown,
  ): Promise<{ training?: TrainingPlan }> {
    try {
      return {
        training: await this.plan(
          ownerId,
          analysisId,
          steamId,
          review as TrainingReview | undefined,
        ),
      };
    } catch {
      return {};
    }
  }
}
