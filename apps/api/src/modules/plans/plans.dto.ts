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
  })
  .strict();
export const featuresSchema = z
  .object({ clipExport: z.boolean(), perMapLearning: z.boolean() })
  .strict();
export const stripePricesSchema = z.record(
  z.string().regex(/^(BRL|USD)_(month|year)$/),
  z.string().regex(/^price_[A-Za-z0-9]{1,200}$/),
);
export type Prices = z.infer<typeof pricesSchema>;
export type PlanLimits = z.infer<typeof limitsSchema>;
export type PlanFeatures = z.infer<typeof featuresSchema>;

/** PUT /v1/admin/plans/:id — every field optional; unspecified fields keep their value. */
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

/** PUT /v1/admin/users/:id/plan — manual grant; `until` null/absent = no end date. */
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

/** Public plan shape (GET /v1/plans). */
export type PlanView = {
  id: string;
  name: string;
  prices: Prices;
  limits: PlanLimits;
  features: PlanFeatures;
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
