import { z } from "zod";

export const CURRENCIES = ["BRL", "USD"] as const;
export const INTERVALS = ["month", "year"] as const;
export type Currency = (typeof CURRENCIES)[number];
export type Interval = (typeof INTERVALS)[number];

const cents = z.number().int().min(0).max(100_000_000);
const quota = z.number().int().min(0).max(100_000).nullable();
export const pricesSchema = z
  .object({
    BRL: z.object({ month: cents, year: cents }).strict().optional(),
    USD: z.object({ month: cents, year: cents }).strict().optional(),
  })
  .strict();
export const limitsSchema = z
  .object({
    aiReviewsPerDay: quota,
    liveAiMatchesPerDay: quota,
    uploadsPerDay: quota,
    retentionDaysMax: z.number().int().min(1).max(365).nullable(),
    /** Plan credits granted each billing period (expire at period end, no rollover). */
    monthlyCredits: z.number().int().min(0).max(100_000),
  })
  .strict();
export const featuresSchema = z
  .object({
    clipExport: z.boolean(),
    perMapLearning: z.boolean(),
    /** Deep reviews cost the "proDeepCost" credit setting instead of "deepCost". */
    cheaperDeep: z.boolean(),
    /** Monthly performance report (scheduled on the 1st + once on demand per period). */
    monthlyReport: z.boolean(),
    /** Full-match highlight/mistake reel (GET /v1/analyses/:id/reel). */
    reel: z.boolean(),
    /** Deep reviews compare with previous deep reviews on the same map. */
    deepHistory: z.boolean(),
    /** Demo processing jobs are claimed before other plans' jobs. */
    priorityQueue: z.boolean(),
    /** Long-term Personal Coach plans (GET/POST /v1/coach/personal). */
    personalCoach: z.boolean(),
  })
  .strict();
export const FEATURE_KEYS = Object.keys(
  featuresSchema.shape,
) as (keyof PlanFeatures)[];
export const stripePricesSchema = z.record(
  z.string().regex(/^(BRL|USD)_(month|year)$/),
  z.string().regex(/^price_[A-Za-z0-9]{1,200}$/),
);
export type Prices = z.infer<typeof pricesSchema>;
export type PlanLimits = z.infer<typeof limitsSchema>;
export type PlanFeatures = z.infer<typeof featuresSchema>;

/** PUT /v1/admin/plans/:id: every field optional; unspecified fields keep their value. */
export const planUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(64).optional(),
    prices: pricesSchema.optional(),
    limits: limitsSchema.partial().strict().optional(),
    features: featuresSchema.partial().strict().optional(),
    stripePrices: stripePricesSchema.optional(),
    active: z.boolean().optional(),
    sort: z.number().int().min(0).max(1000).optional(),
  })
  .strict();
export type PlanUpdate = z.infer<typeof planUpdateSchema>;

export const planIdSchema = z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/);

/** PUT /v1/admin/users/:id/plan: manual grant; `until` null/absent = no end date. */
export const planGrantSchema = z
  .object({
    planId: planIdSchema,
    until: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .strict();
export type PlanGrant = z.infer<typeof planGrantSchema>;

export type SubscriptionStatus =
  "active" | "trialing" | "past_due" | "canceled";
export type SubscriptionSource = "admin" | "stripe";

/** Credit economics of a plan, for the comparison table. */
export type PlanCreditsView = {
  monthly: number;
  quickCost: number;
  deepCost: number;
};
/** Public plan shape (GET /v1/plans). */
export type PlanView = {
  id: string;
  name: string;
  prices: Prices;
  limits: PlanLimits;
  features: PlanFeatures;
  credits: PlanCreditsView;
  /** Enabled feature keys in display order (for the comparison table). */
  benefits: (keyof PlanFeatures)[];
};
/** Admin plan shape (GET /v1/admin/plans). */
export type AdminPlanView = PlanView & {
  active: boolean;
  sort: number;
  stripePrices: Record<string, string>;
};
/** The caller's plan as shown in GET /v1/me. */
export type AccountPlanView = {
  id: string;
  name: string;
  status: SubscriptionStatus;
  source: SubscriptionSource | "default" | "role";
  renewsAt?: string;
  limits: PlanLimits;
  features: PlanFeatures;
};
export type EffectivePlan = {
  id: string;
  name: string;
  admin: boolean;
  limits: PlanLimits;
  features: PlanFeatures;
};
/** One user's plan in the admin users list. */
export type AccountPlanSummary = {
  id: string;
  name: string;
  status: SubscriptionStatus;
  source: SubscriptionSource | "default";
  renewsAt?: string;
};
