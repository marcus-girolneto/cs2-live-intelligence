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
  /** Credits granted every month by the plan (expire at renewal). */
  monthlyCredits: number | null;
  /** Credits charged for a Deep review on this plan (display; from GET plans `credits`). */
  deepCost: number | null;
  /** Deep reviews cost the discounted "Pro" price. */
  cheaperDeep: boolean;
  /** Personal Coach: a general plan written from all matches (Pro). */
  personalCoach: boolean;
  monthlyReport: boolean;
  matchReel: boolean;
  historyCompare: boolean;
  priorityQueue: boolean;
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
  | "ai_review"
  | "live_ai"
  | "upload"
  | "clip_export"
  | "per_map"
  | "monthly_report"
  | "match_reel"
  | "history_compare"
  | "personal_coach";
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
      monthlyCredits: 0,
      deepCost: 3,
      cheaperDeep: false,
      personalCoach: false,
      monthlyReport: false,
      matchReel: false,
      historyCompare: false,
      priorityQueue: false,
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
      monthlyCredits: 10,
      deepCost: 3,
      cheaperDeep: false,
      personalCoach: false,
      monthlyReport: false,
      matchReel: false,
      historyCompare: false,
      priorityQueue: false,
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
      monthlyCredits: 30,
      deepCost: 2,
      cheaperDeep: true,
      personalCoach: true,
      monthlyReport: true,
      matchReel: true,
      historyCompare: true,
      priorityQueue: true,
    },
    active: true,
  },
];
