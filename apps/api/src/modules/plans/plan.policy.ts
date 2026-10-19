import type {
  EffectivePlan,
  PlanLimits,
  SubscriptionStatus,
} from "./plans.dto.js";
import type { PlanRecord, SubscriptionRecord } from "./plans.repository.js";

export const FREE_PLAN_ID = "free";
/** Used only if the free plan row is missing (it is seeded by migration 0006). */
export const FALLBACK_FREE: PlanRecord = {
  id: FREE_PLAN_ID,
  name: "Free",
  prices: {},
  limits: {
    aiReviewsPerDay: null,
    liveAiMatchesPerDay: 0,
    uploadsPerDay: 2,
    retentionDaysMax: 30,
    monthlyCredits: 0,
  },
  features: {
    clipExport: false,
    perMapLearning: false,
    cheaperDeep: false,
    monthlyReport: false,
    reel: false,
    deepHistory: false,
    priorityQueue: false,
    personalCoach: false,
  },
  stripePrices: {},
  active: true,
  sort: 0,
};
const UNLIMITED: PlanLimits = {
  aiReviewsPerDay: null,
  liveAiMatchesPerDay: null,
  uploadsPerDay: null,
  retentionDaysMax: null,
  monthlyCredits: 0,
};
/** Statuses that keep paid access (past_due keeps access while the provider retries payment). */
const ENTITLED: SubscriptionStatus[] = ["active", "trialing", "past_due"];
export type LimitKey = keyof Omit<PlanLimits, "retentionDaysMax">;

/**
 * Policy object for plan entitlements. Pure: given the account's role, subscription and the
 * plan catalogue it decides which plan applies, its limits, retention and upgrade path.
 */
export const PlanPolicy = {
  /** True when the subscription currently grants its plan. */
  entitled(
    sub: SubscriptionRecord | undefined,
    now: Date,
  ): sub is SubscriptionRecord {
    return (
      !!sub &&
      ENTITLED.includes(sub.status) &&
      (sub.currentPeriodEnd === null ||
        Date.parse(sub.currentPeriodEnd) > now.getTime())
    );
  },

  /** The plan that applies to a non-admin account. */
  applicable(
    sub: SubscriptionRecord | undefined,
    plans: (id: string) => PlanRecord | undefined,
    now: Date,
  ): PlanRecord {
    const free = plans(FREE_PLAN_ID) ?? FALLBACK_FREE;
    return PlanPolicy.entitled(sub, now) ? (plans(sub.planId) ?? free) : free;
  },

  /** Administrators are unlimited and get every feature. */
  admin(): EffectivePlan {
    return {
      id: "admin",
      name: "Administrator",
      admin: true,
      limits: { ...UNLIMITED },
      features: {
        clipExport: true,
        perMapLearning: true,
        cheaperDeep: true,
        monthlyReport: true,
        reel: true,
        deepHistory: true,
        priorityQueue: true,
        personalCoach: true,
      },
    };
  },

  effective(plan: PlanRecord): EffectivePlan {
    return {
      id: plan.id,
      name: plan.name,
      admin: false,
      limits: plan.limits,
      features: plan.features,
    };
  },

  /** Requested retention clamped to the plan maximum. */
  clampRetention(plan: EffectivePlan, requested: number): number {
    const max = plan.limits.retentionDaysMax;
    return max === null ? requested : Math.min(requested, max);
  },

  /** Credits charged for a review tier on this plan. */
  reviewCost(
    plan: Pick<EffectivePlan, "features">,
    tier: "quick" | "deep" | "team",
    costs: {
      quickCost: number;
      deepCost: number;
      proDeepCost: number;
      teamCost?: number;
      proTeamCost?: number;
    },
  ): number {
    if (tier === "quick") return costs.quickCost;
    if (tier === "team")
      return plan.features.cheaperDeep
        ? (costs.proTeamCost ?? 3)
        : (costs.teamCost ?? 4);
    return plan.features.cheaperDeep ? costs.proDeepCost : costs.deepCost;
  },

  /** Next active plan in display order with a higher (or unlimited) value for `key`. */
  upgradeFor(
    plans: PlanRecord[],
    currentId: string,
    key: LimitKey,
    current: number,
  ): string | null {
    const better = plans
      .filter((p) => p.active && p.id !== currentId)
      .find((p) => {
        const v = p.limits[key];
        return v === null || v > current;
      });
    return better?.id ?? null;
  },
};
