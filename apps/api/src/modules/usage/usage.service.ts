import type { Clock } from "../../shared/clock/clock.js";
import { PlanLimitError, type PlanFeature } from "../../shared/errors/index.js";
import type { EffectivePlan } from "../plans/plans.dto.js";
import type { LimitKey } from "../plans/plan.policy.js";
import type { CounterKind, UsageRepository } from "./usage.repository.js";

/** What the quota service needs from plans. */
export interface PlanLookup {
  effective(ownerId: string): Promise<EffectivePlan>;
  upgradeFor(
    currentId: string,
    key: LimitKey,
    current: number,
  ): Promise<string | null>;
}
/** A consumed unit that can be given back when the operation fails. */
export interface Reservation {
  release(): Promise<void>;
}
export const LIVE_CALLS_PER_MATCH = 40;
export type UsageView = {
  day: string;
  resetsAt: string;
  aiReviews: { used: number; limit: number | null };
  liveAiMatches: { used: number; limit: number | null };
  uploads: { used: number; limit: number | null };
};

const FEATURE_KEY: Record<PlanFeature, LimitKey> = {
  ai_review: "aiReviewsPerDay",
  live_ai: "liveAiMatchesPerDay",
  uploads: "uploadsPerDay",
};
const MESSAGES: Record<PlanFeature, string> = {
  ai_review: "You have used all AI reviews included in your plan today.",
  live_ai: "Your plan does not include more live AI coaching matches today.",
  uploads: "You have used all demo uploads included in your plan today.",
};
const noop: Reservation = { release: async () => undefined };

/**
 * Daily plan quotas. Reservations are atomic (see UsageRepository); callers release a
 * reservation when the operation fails so only successful work counts.
 */
export class QuotaService {
  constructor(
    private readonly usage: UsageRepository,
    private readonly plans: PlanLookup,
    private readonly clock: Clock,
    private readonly liveCallsPerMatch = LIVE_CALLS_PER_MATCH,
  ) {}

  private async limitError(
    plan: EffectivePlan,
    feature: PlanFeature,
    limit: number,
    message?: string,
  ): Promise<PlanLimitError> {
    return new PlanLimitError({
      feature,
      limit,
      resetsAt: this.clock.nextMidnight(),
      upgradeTo: await this.plans.upgradeFor(
        plan.id,
        FEATURE_KEY[feature],
        limit,
      ),
      message: message ?? MESSAGES[feature],
    });
  }
  private async counter(
    ownerId: string,
    feature: "ai_review" | "uploads",
    kind: CounterKind,
  ): Promise<Reservation> {
    const plan = await this.plans.effective(ownerId);
    const limit = plan.limits[FEATURE_KEY[feature]];
    if (plan.admin) return noop;
    const day = this.clock.day();
    if (!(await this.usage.reserve(ownerId, day, kind, limit)))
      throw await this.limitError(plan, feature, limit ?? 0);
    return { release: () => this.usage.release(ownerId, day, kind) };
  }
  /** One AI player review; throws PlanLimitError (402) when the daily quota is used up. */
  reserveReview(ownerId: string): Promise<Reservation> {
    return this.counter(ownerId, "ai_review", "ai_review");
  }
  /** One demo upload or sample import. */
  reserveUpload(ownerId: string): Promise<Reservation> {
    return this.counter(ownerId, "uploads", "upload");
  }
  /** One live AI call inside match `matchKey`. */
  async reserveLiveCall(
    ownerId: string,
    matchKey: string,
  ): Promise<Reservation> {
    const plan = await this.plans.effective(ownerId);
    if (plan.admin) return noop;
    const limit = plan.limits.liveAiMatchesPerDay;
    const day = this.clock.day();
    const result = await this.usage.reserveLive(
      ownerId,
      day,
      matchKey.slice(0, 160),
      limit,
      this.liveCallsPerMatch,
    );
    if (result === "match_limit")
      throw await this.limitError(plan, "live_ai", limit ?? 0);
    if (result === "match_cap")
      throw await this.limitError(
        plan,
        "live_ai",
        limit ?? 0,
        `This match already received ${this.liveCallsPerMatch} live AI calls today.`,
      );
    return {
      release: () =>
        this.usage.releaseLive(ownerId, day, matchKey.slice(0, 160)),
    };
  }
  /** GET /v1/me `usage`. */
  async usageView(ownerId: string): Promise<UsageView> {
    const plan = await this.plans.effective(ownerId);
    const day = this.clock.day();
    const [reviews, uploads, live] = await Promise.all([
      this.usage.used(ownerId, day, "ai_review"),
      this.usage.used(ownerId, day, "upload"),
      this.usage.liveMatches(ownerId, day),
    ]);
    return {
      day,
      resetsAt: this.clock.nextMidnight(),
      aiReviews: { used: reviews, limit: plan.limits.aiReviewsPerDay },
      liveAiMatches: { used: live, limit: plan.limits.liveAiMatchesPerDay },
      uploads: { used: uploads, limit: plan.limits.uploadsPerDay },
    };
  }
}
