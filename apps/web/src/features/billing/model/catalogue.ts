/** Plan types and the published v1 catalogue (fallback when the plans endpoint is unavailable). */
export type Interval = "month" | "year";
export type Currency = "BRL" | "USD";
export type PlanId = "free" | "basic" | "pro" | (string & {});
export type PlanLimits = {
  /** null = unlimited */
  aiReviewsPerDay: number | null;
  liveAiMatchesPerDay: number | null;
  uploadsPerDay: number | null;
  retentionDays: number | null;
  clipExport: boolean;
  perMapLearning: boolean;
};
export type Price = { month: number; year: number };
export type Plan = {
  id: PlanId;
  name: string;
  prices: Record<Currency, Price>;
  limits: PlanLimits;
  active: boolean;
};
export type Counter = { used: number; limit: number | null };
export type Usage = {
  day?: string;
  resetsAt?: string;
  aiReviews?: Counter;
  liveAiMatches?: Counter;
  uploads?: Counter;
};
export type AccountPlan = {
  id: PlanId;
  name: string;
  status?: string;
  renewsAt?: string;
  source?: string;
  /** Effective limits/features of the account (admins: unlimited). */
  limits?: PlanLimits;
};
export type LimitFeature =
  "ai_review" | "live_ai" | "upload" | "clip_export" | "per_map";
export type PlanLimitError = {
  feature: LimitFeature;
  limit: number | null;
  resetsAt?: string;
  upgradeTo?: PlanId;
};

export const DEFAULT_PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    prices: { BRL: { month: 0, year: 0 }, USD: { month: 0, year: 0 } },
    limits: {
      aiReviewsPerDay: 1,
      liveAiMatchesPerDay: 0,
      uploadsPerDay: 2,
      retentionDays: 30,
      clipExport: false,
      perMapLearning: false,
    },
    active: true,
  },
  {
    id: "basic",
    name: "Basic",
    prices: {
      BRL: { month: 1490, year: 14900 },
      USD: { month: 499, year: 4990 },
    },
    limits: {
      aiReviewsPerDay: 3,
      liveAiMatchesPerDay: 1,
      uploadsPerDay: 5,
      retentionDays: 90,
      clipExport: true,
      perMapLearning: false,
    },
    active: true,
  },
  {
    id: "pro",
    name: "Pro",
    prices: {
      BRL: { month: 2990, year: 29900 },
      USD: { month: 999, year: 9990 },
    },
    limits: {
      aiReviewsPerDay: 8,
      liveAiMatchesPerDay: 5,
      uploadsPerDay: 15,
      retentionDays: 365,
      clipExport: true,
      perMapLearning: true,
    },
    active: true,
  },
];
