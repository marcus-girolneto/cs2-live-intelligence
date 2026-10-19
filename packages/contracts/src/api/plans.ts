import { z } from "zod";

export const CURRENCIES = ["BRL", "USD"] as const;
export const INTERVALS = ["month", "year"] as const;
export type Currency = (typeof CURRENCIES)[number];
export type Interval = (typeof INTERVALS)[number];

export type Prices = Partial<Record<Currency, { month: number; year: number }>>;
/** null = unlimited. */
export type PlanLimits = {
  aiReviewsPerDay: number | null;
  liveAiMatchesPerDay: number | null;
  uploadsPerDay: number | null;
  retentionDaysMax: number | null;
  /** Plan credits granted each period (expire at period end). */
  monthlyCredits: number;
};
export type PlanFeatures = {
  clipExport: boolean;
  perMapLearning: boolean;
  cheaperDeep: boolean;
  monthlyReport: boolean;
  reel: boolean;
  deepHistory: boolean;
  priorityQueue: boolean;
  personalCoach: boolean;
};
export type SubscriptionStatus =
  "active" | "trialing" | "past_due" | "canceled";
export type SubscriptionSource = "admin" | "stripe";

/** GET /v1/plans item. */
export type PlanView = {
  id: string;
  name: string;
  prices: Prices;
  limits: PlanLimits;
  features: PlanFeatures;
  credits: { monthly: number; quickCost: number; deepCost: number };
  /** Enabled feature keys in display order. */
  benefits: (keyof PlanFeatures)[];
};
/** GET /v1/admin/plans item. */
export type AdminPlanView = PlanView & {
  active: boolean;
  sort: number;
  stripePrices: Record<string, string>;
};
/** The caller's plan (GET /v1/me `plan`). */
export type AccountPlanView = {
  id: string;
  name: string;
  status: SubscriptionStatus;
  source: SubscriptionSource | "default" | "role";
  renewsAt?: string;
  limits: PlanLimits;
  features: PlanFeatures;
};
type Counter = { used: number; limit: number | null };
/** GET /v1/me `usage` (daily, in the app time zone). */
export type UsageView = {
  day: string;
  resetsAt: string;
  aiReviews: Counter;
  liveAiMatches: Counter;
  uploads: Counter;
};
/** 402 body when a plan quota is exhausted. */
export type PlanLimitErrorDto = {
  error: string;
  code: "plan_limit";
  feature: "ai_review" | "live_ai" | "uploads";
  limit: number;
  resetsAt: string;
  upgradeTo: string | null;
};

/** GET /v1/billing/status. */
export type BillingStatusDto =
  | { enabled: false }
  | {
      enabled: true;
      provider: string;
      currencies: string[];
      intervals: string[];
      paymentMethods: Record<string, string[]>;
    };
/** POST /v1/billing/checkout body. */
export const checkoutRequestSchema = z
  .object({
    planId: z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/),
    interval: z.enum(INTERVALS),
    currency: z.enum(CURRENCIES),
  })
  .strict();
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
/** POST /v1/billing/checkout and /v1/billing/portal response. */
export type RedirectDto = { url: string };
/** GET /v1/plans. */
export type PlansListDto = {
  plans: PlanView[];
  /** Demo upload limit for every plan (bytes). */
  uploads?: { maxDemoBytes: number };
};
