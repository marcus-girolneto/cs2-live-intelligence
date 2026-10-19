import { z } from "zod";
import { CURRENCIES } from "../plans/plans.dto.js";

/** Spend order: plan credits first (they expire), then bonus, then purchased (never expire). */
export const BUCKETS = ["plan", "bonus", "purchased"] as const;
export type Bucket = (typeof BUCKETS)[number];
export type Buckets = Record<Bucket, number>;
export const CREDIT_REASONS = [
  "welcome",
  "plan_grant",
  "purchase",
  "review_quick",
  "review_deep",
  "review_team",
  "refund",
  "admin_adjust",
  "expire",
] as const;
export type CreditReason = (typeof CREDIT_REASONS)[number];
/** Review kinds that cost credits ("team" = one review of the whole team). */
export type ReviewTier = "quick" | "deep" | "team";

const small = (min: number, max: number) => z.number().int().min(min).max(max);
/** Admin-editable credit settings (GET/PUT /v1/admin/credits/settings). */
export const creditSettingsSchema = z
  .object({
    /** Bonus credits for a new, eligible Steam account (once per Steam id ever). */
    welcomeCredits: small(0, 100),
    quickCost: small(1, 100),
    deepCost: small(1, 100),
    /** Deep cost on plans with the cheaperDeep feature (Pro). */
    proDeepCost: small(1, 100),
    /** Team review (whole 5-stack in one AI call). */
    teamCost: small(1, 100),
    /** Team review cost on plans with the cheaperDeep feature (Pro). */
    proTeamCost: small(1, 100),
    /** Per-account AI reviews per day, whatever the balance. */
    dailySafetyCap: small(1, 1000),
    minSteamAgeDays: small(0, 3650),
    /** Welcome grants per /24 (IPv4) or /48 (IPv6) network within networkWindowDays. */
    maxGrantsPerNetwork: small(1, 1000),
    networkWindowDays: small(1, 365),
  })
  .strict();
export type CreditSettings = z.infer<typeof creditSettingsSchema>;
export const DEFAULT_CREDIT_SETTINGS: CreditSettings = {
  welcomeCredits: 1,
  quickCost: 1,
  deepCost: 3,
  proDeepCost: 2,
  teamCost: 4,
  proTeamCost: 3,
  dailySafetyCap: 30,
  minSteamAgeDays: 30,
  maxGrantsPerNetwork: 3,
  networkWindowDays: 30,
};
export const creditSettingsPatchSchema = creditSettingsSchema
  .partial()
  .strict();

/** POST /v1/admin/users/:id/credits. Negative deltas cannot exceed the bucket's free balance. */
export const adjustRequestSchema = z
  .object({
    delta: z
      .number()
      .int()
      .min(-100_000)
      .max(100_000)
      .refine((v) => v !== 0, "delta must not be 0"),
    note: z.string().trim().min(1).max(300),
    bucket: z.enum(BUCKETS).optional(),
  })
  .strict();
export type AdjustRequest = z.infer<typeof adjustRequestSchema>;
export const ledgerQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const cents = z.number().int().min(0).max(100_000_000);
export const packIdSchema = z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/);
export const packSchema = z
  .object({
    id: packIdSchema,
    name: z.string().trim().min(1).max(64),
    credits: small(1, 100_000),
    prices: z.object({ BRL: cents.optional(), USD: cents.optional() }).strict(),
    /** Optional Stripe price ids per currency; without one Checkout uses inline price data. */
    stripePrices: z
      .record(
        z.enum(CURRENCIES),
        z.string().regex(/^price_[A-Za-z0-9]{1,200}$/),
      )
      .optional(),
    badge: z.string().trim().max(32).nullable().optional(),
    active: z.boolean(),
    sort: small(0, 1000),
  })
  .strict();
export type PackInput = z.infer<typeof packSchema>;
/** PUT /v1/admin/credits/packs: upserts the given packs (deactivate instead of deleting). */
export const packsUpdateSchema = z
  .object({ packs: z.array(packSchema).min(1).max(20) })
  .strict();
/** POST /v1/billing/credits/checkout. */
export const creditCheckoutSchema = z
  .object({ packId: packIdSchema, currency: z.enum(CURRENCIES) })
  .strict();
export type CreditCheckoutRequest = z.infer<typeof creditCheckoutSchema>;

export type PackRecord = {
  id: string;
  name: string;
  credits: number;
  prices: Partial<Record<(typeof CURRENCIES)[number], number>>;
  stripePrices: Partial<Record<(typeof CURRENCIES)[number], string>>;
  badge: string | null;
  active: boolean;
  sort: number;
};
/** GET /v1/credits/packs item. */
export type PackView = {
  id: string;
  name: string;
  credits: number;
  prices: Partial<Record<(typeof CURRENCIES)[number], number>>;
  badge?: string;
};
export type AdminPackView = PackView & {
  stripePrices: Partial<Record<(typeof CURRENCIES)[number], string>>;
  active: boolean;
  sort: number;
};

export type WelcomeStatus = "granted" | "ineligible" | "pending";
export type WelcomeReason =
  | "not_steam"
  | "banned"
  | "account_too_new"
  | "profile_private"
  | "profile_unavailable"
  | "network_limit"
  | "already_claimed"
  | "disabled"
  | "not_evaluated";
export type WelcomeView = { status: WelcomeStatus; reason?: WelcomeReason };

/** GET /v1/me `credits`. */
export type CreditsView = {
  balance: number;
  buckets: Buckets;
  planExpiresAt?: string;
  welcome: WelcomeView;
  costs: Record<ReviewTier, number>;
};
/** GET /v1/credits/ledger and GET /v1/admin/users/:id/ledger item. */
export type LedgerEntryDto = {
  id: string;
  delta: number;
  reason: CreditReason;
  bucket: Bucket;
  ref?: string;
  note?: string;
  expiresAt?: string;
  createdAt: string;
};
export type LedgerDto = { entries: LedgerEntryDto[] };
