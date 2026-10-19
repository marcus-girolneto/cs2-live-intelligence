import { z } from "zod";
import { CURRENCIES, type Currency } from "./plans.js";

export type CreditBucket = "plan" | "bonus" | "purchased";
export type ReviewTierDto = "quick" | "deep";
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
/** GET /v1/me `credits`. */
export type CreditsDto = {
  balance: number;
  buckets: Record<CreditBucket, number>;
  /** When the plan bucket expires (only while it holds credits). */
  planExpiresAt?: string;
  welcome: {
    status: "granted" | "ineligible" | "pending";
    reason?: WelcomeReason;
  };
  /** `team`: cost of a team review (absent on older servers). */
  costs: Record<ReviewTierDto, number> & { team?: number };
};
export type CreditReasonDto =
  | "welcome"
  | "plan_grant"
  | "purchase"
  | "review_quick"
  | "review_deep"
  | "review_team"
  | "refund"
  | "admin_adjust"
  | "expire";
/** GET /v1/credits/ledger (and /v1/admin/users/:id/ledger with userId). */
export type LedgerDto = {
  entries: {
    id: string;
    delta: number;
    reason: CreditReasonDto;
    bucket: CreditBucket;
    ref?: string;
    note?: string;
    expiresAt?: string;
    createdAt: string;
  }[];
};
/** GET /v1/credits/packs item (prices in minor units). */
export type CreditPackDto = {
  id: string;
  name: string;
  credits: number;
  prices: Partial<Record<Currency, number>>;
  badge?: string;
};
export type AdminCreditPackDto = CreditPackDto & {
  stripePrices: Partial<Record<Currency, string>>;
  active: boolean;
  sort: number;
};
/** 402 body when the balance does not cover the review tier. */
export type InsufficientCreditsDto = {
  error: string;
  code: "insufficient_credits";
  tier: ReviewTierDto;
  needed: number;
  balance: number;
  packs: CreditPackDto[];
  upgradeTo: string | null;
};
/** 402 body for a feature of a higher plan (reel, monthly report, personal coach). */
export type PlanFeatureErrorDto = {
  error: string;
  code: "plan_feature";
  feature: string;
  upgradeTo: string | null;
};
/** GET/PUT /v1/admin/credits/settings. */
export type CreditSettingsDto = {
  welcomeCredits: number;
  quickCost: number;
  deepCost: number;
  proDeepCost: number;
  /** Team review cost (Pro: proTeamCost). */
  teamCost?: number;
  proTeamCost?: number;
  dailySafetyCap: number;
  minSteamAgeDays: number;
  maxGrantsPerNetwork: number;
  networkWindowDays: number;
};
/** POST /v1/billing/credits/checkout body. */
export const creditCheckoutRequestSchema = z
  .object({
    packId: z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/),
    currency: z.enum(CURRENCIES),
  })
  .strict();
/** POST /v1/admin/users/:id/credits body. */
export type CreditAdjustRequest = {
  delta: number;
  note: string;
  bucket?: CreditBucket;
};
