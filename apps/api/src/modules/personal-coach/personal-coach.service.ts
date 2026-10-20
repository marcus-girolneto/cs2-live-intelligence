import { buildCoachAggregates, type CoachHistoryInput } from "@cs2/coaching";
import {
  analysisSchema,
  type DeepReview,
  type PersonalCoachPlan,
} from "@cs2/contracts";
import type {
  AiGateway,
  CoachLanguage,
} from "../../infrastructure/ai/coaching-ai-gateway.js";
import type { Clock } from "../../shared/clock/clock.js";
import {
  AppError,
  ConflictError,
  TooManyRequestsError,
} from "../../shared/errors/index.js";
import type { Logger } from "../../shared/logging/logger.js";
import { aiRequestError } from "../ai-config/ai-errors.js";
import type { AiAccess } from "../coaching/coaching.ports.js";
import type { ViewerPolicy } from "../coaching/viewer.policy.js";
import type {
  CoachPlanRecord,
  PersonalCoachRepository,
} from "./personal-coach.repository.js";

/** Everything the Personal Coach reads (ports implemented by matches, coaching, plans, ai-config). */
export interface PersonalCoachInputs {
  playerSteamId(ownerId: string): Promise<string | null>;
  /** The own matches (ids and upload dates only: an indexed query, no documents). */
  completedMatches(
    ownerId: string,
    limit: number,
  ): Promise<{ id: string; createdAt: string }[]>;
  /** Full analyses (documents from object storage), loaded only to generate a plan. */
  completedAnalyses(
    ownerId: string,
    limit: number,
  ): Promise<{ id: string; createdAt: string; analysis: unknown }[]>;
  /** Earlier reviews: plan items, rating and date. */
  reviews(ownerId: string): Promise<
    {
      createdAt: string;
      rating: number | null;
      planItems: { text: string; scope?: string; map?: string }[];
    }[]
  >;
  deepReviews(
    ownerId: string,
    steamId: string,
  ): Promise<{ analysisId: string; createdAt: string; deep: DeepReview }[]>;
  liveCalls(ownerId: string): Promise<number>;
  enabled(ownerId: string): Promise<boolean>;
  settings(): Promise<{
    personalCoachIntervalDays: number;
    personalCoachNewMatches: number;
  }>;
}
/** Port the AI gateway implements for this module. */
export interface PersonalCoachModel {
  personalCoach: AiGateway["personalCoach"];
}

const MAX_ANALYSES = 500;
const DAY = 86_400_000;
export type PersonalCoachView = {
  latest: {
    id: string;
    createdAt: string;
    trigger: "manual" | "auto";
    plan: PersonalCoachPlan;
    provider?: string;
    model?: string;
  } | null;
  history: {
    id: string;
    createdAt: string;
    headline: string;
    basedOnMatches: number;
  }[];
  analyzedMatches: number;
  newMatchesSinceLast: number;
  /** null: a new plan can be generated now. */
  nextAvailableAt: string | null;
  autoRegenerateAfterMatches: number;
};

/**
 * Pro Personal Coach: deterministic aggregates of the whole history plus one AI call (purpose
 * personal_coach, no credits). Regenerated at most once per interval (admin setting, default
 * 7 days) unless N new analyses arrived (default 3), which also triggers auto-regeneration.
 */
export class PersonalCoachService {
  constructor(
    private readonly plans: PersonalCoachRepository,
    private readonly inputs: PersonalCoachInputs,
    private readonly ai: AiAccess,
    private readonly gateway: PersonalCoachModel,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {}

  /** 402 plan_required with counts only (teaser) for accounts without the feature. */
  private async requirePro(ownerId: string): Promise<void> {
    if (await this.inputs.enabled(ownerId)) return;
    const [analyses, reviews] = await Promise.all([
      this.inputs.completedMatches(ownerId, MAX_ANALYSES),
      this.inputs.reviews(ownerId),
    ]);
    throw new AppError(402, "The Personal Coach is included in the Pro plan.", {
      code: "plan_required",
      details: {
        feature: "personal_coach",
        upgradeTo: "pro",
        teaser: {
          analyzedMatches: analyses.length,
          reviews: reviews.length,
          plansGiven: reviews.reduce((n, r) => n + r.planItems.length, 0),
        },
      },
    });
  }

  private async state(ownerId: string) {
    const [history, analyses, settings] = await Promise.all([
      this.plans.history(ownerId, 20),
      this.inputs.completedMatches(ownerId, MAX_ANALYSES),
      this.inputs.settings(),
    ]);
    const latest = history[0];
    const since = latest?.lastAnalysisAt
      ? Date.parse(latest.lastAnalysisAt)
      : -Infinity;
    const newMatches = latest
      ? analyses.filter((a) => Date.parse(a.createdAt) > since).length
      : analyses.length;
    const cooldownEnds = latest
      ? Date.parse(latest.createdAt) + settings.personalCoachIntervalDays * DAY
      : -Infinity;
    const open =
      !latest ||
      cooldownEnds <= this.clock.now().getTime() ||
      newMatches >= settings.personalCoachNewMatches;
    return {
      history,
      analyses,
      settings,
      latest,
      newMatches,
      cooldownEnds,
      open,
    };
  }

  async view(
    ownerId: string,
    viewer: ViewerPolicy,
  ): Promise<PersonalCoachView> {
    await this.requirePro(ownerId);
    const s = await this.state(ownerId);
    return {
      latest: s.latest ? this.latestView(s.latest, viewer) : null,
      history: s.history.map((h) => ({
        id: h.id,
        createdAt: h.createdAt,
        headline: h.plan.headline,
        basedOnMatches: h.basedOnMatches,
      })),
      analyzedMatches: s.analyses.length,
      newMatchesSinceLast: s.newMatches,
      nextAvailableAt: s.open ? null : new Date(s.cooldownEnds).toISOString(),
      autoRegenerateAfterMatches: s.settings.personalCoachNewMatches,
    };
  }

  /** POST /v1/coach/personal/generate (429 personal_coach_cooldown inside the interval). */
  async generate(
    ownerId: string,
    lang: CoachLanguage,
    viewer: ViewerPolicy,
    trigger: "manual" | "auto" = "manual",
  ): Promise<PersonalCoachView> {
    await this.requirePro(ownerId);
    const s = await this.state(ownerId);
    if (!s.open) {
      const retryAfterSeconds = Math.ceil(
        (s.cooldownEnds - this.clock.now().getTime()) / 1000,
      );
      throw new TooManyRequestsError(
        "Your personal plan was generated recently.",
        {
          code: "personal_coach_cooldown",
          details: {
            nextAvailableAt: new Date(s.cooldownEnds).toISOString(),
            newMatchesNeeded: s.settings.personalCoachNewMatches - s.newMatches,
          },
          headers: { "retry-after": String(retryAfterSeconds) },
        },
      );
    }
    const steamId = await this.inputs.playerSteamId(ownerId);
    const documents = await this.inputs.completedAnalyses(
      ownerId,
      MAX_ANALYSES,
    );
    const analyses = documents.flatMap((a) => {
      const parsed = analysisSchema.safeParse(a.analysis);
      return parsed.success
        ? [{ id: a.id, createdAt: a.createdAt, analysis: parsed.data }]
        : [];
    });
    const reviews = await this.inputs.reviews(ownerId);
    const history: CoachHistoryInput | undefined = steamId
      ? {
          steamId,
          analyses,
          deepReviews: await this.inputs.deepReviews(ownerId, steamId),
          plans: reviews.flatMap((r) =>
            r.planItems.map((p) => ({ createdAt: r.createdAt, ...p })),
          ),
          ratings: reviews
            .map((r) => r.rating)
            .filter((r): r is number => typeof r === "number"),
          liveCalls: await this.inputs.liveCalls(ownerId),
        }
      : undefined;
    const aggregates = history ? buildCoachAggregates(history) : undefined;
    if (!steamId || !aggregates?.basedOnMatches)
      throw new ConflictError("Analyze at least one match of yours first.", {
        code: "not_enough_data",
      });
    const config = await this.ai.acquire(ownerId, "personal_coach");
    let result;
    try {
      result = await this.gateway.personalCoach(
        aggregates,
        config,
        lang,
        this.clock.now().toISOString(),
      );
    } catch (error) {
      throw aiRequestError(error, viewer.admin, this.logger);
    }
    const newest = analyses.reduce<string | null>(
      (m, a) =>
        m === null || Date.parse(a.createdAt) > Date.parse(m) ? a.createdAt : m,
      null,
    );
    await this.plans.save({
      ownerId,
      steamId,
      lang,
      trigger,
      plan: result.plan,
      lastAnalysisAt: newest,
      provider: result.call.provider,
      model: result.call.model,
      promptVersion: result.plan.promptVersion,
      createdAt: this.clock.now().toISOString(),
    });
    this.logger.info(
      {
        ownerId,
        trigger,
        matches: aggregates.basedOnMatches,
        latencyMs: result.call.latencyMs,
      },
      "personal coach plan",
    );
    return this.view(ownerId, viewer);
  }

  /** Hourly job: regenerate when enough new analyses arrived since the last plan. */
  async autoRegenerate(
    ownerId: string,
    viewer: ViewerPolicy,
  ): Promise<boolean> {
    if (!(await this.inputs.enabled(ownerId))) return false;
    const s = await this.state(ownerId);
    if (!s.latest || s.newMatches < s.settings.personalCoachNewMatches)
      return false;
    await this.generate(
      ownerId,
      s.latest.lang === "pt" ? "pt" : "en",
      viewer,
      "auto",
    );
    return true;
  }

  private latestView(
    r: CoachPlanRecord,
    viewer: ViewerPolicy,
  ): NonNullable<PersonalCoachView["latest"]> {
    return {
      id: r.id,
      createdAt: r.createdAt,
      trigger: r.trigger,
      plan: r.plan,
      ...(viewer.admin ? { provider: r.provider, model: r.model } : {}),
    };
  }
}
