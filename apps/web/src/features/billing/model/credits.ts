/**
 * Credits: balance by bucket, the welcome grant, review costs, the ledger and credit packs.
 * Everything from the API is optional and validated here (no NaN / undefined on screen).
 */
import { finite, text } from "@/shared/format";
import type { Currency, PlanId } from "./catalogue";
import { obj } from "./normalize";

export type ReviewTier = "quick" | "deep" | "team";
export type CreditBucket = "plan" | "bonus" | "purchased";
export type WelcomeReason =
  | "banned"
  | "account_too_new"
  | "profile_private"
  | "profile_unavailable"
  | "network_limit"
  | "already_claimed"
  | "not_steam"
  | "disabled"
  | "not_evaluated";
export type Welcome =
  | { status: "granted" }
  | { status: "pending" | "ineligible"; reason: WelcomeReason | null };
export type Credits = {
  balance: number;
  buckets: Record<CreditBucket, number>;
  planExpiresAt?: string;
  welcome?: Welcome;
  costs: Record<ReviewTier, number>;
};
export type CreditPack = {
  id: string;
  name: string;
  credits: number;
  prices: Record<Currency, number>;
  badge?: string;
};
export type LedgerEntry = {
  id: string;
  delta: number;
  reason: string;
  bucket: CreditBucket | null;
  createdAt: string;
  ref?: string;
  note?: string;
};
export type InsufficientCredits = {
  needed: number | null;
  balance: number | null;
  packs: CreditPack[];
  upgradeTo?: PlanId;
  tier?: ReviewTier;
};

/** Published defaults: Quick 1 credit, Deep 3 (2 on Pro). */
export const DEFAULT_COSTS: Record<ReviewTier, number> = {
  quick: 1,
  deep: 3,
  team: 4,
};
const REASONS: WelcomeReason[] = [
  "banned",
  "account_too_new",
  "profile_private",
  "profile_unavailable",
  "network_limit",
  "already_claimed",
  "not_steam",
  "disabled",
  "not_evaluated",
];
const BUCKETS: CreditBucket[] = ["plan", "bonus", "purchased"];
const count = (v: unknown) => {
  const n = finite(v);
  return n === null ? null : Math.max(0, Math.round(n));
};

function welcomeOf(raw: unknown): Welcome | undefined {
  const o = obj(raw);
  if (!o) return undefined;
  if (o.status === "granted") return { status: "granted" };
  if (o.status !== "ineligible" && o.status !== "pending") return undefined;
  const reason = REASONS.find((r) => r === o.reason) ?? null;
  return { status: o.status, reason };
}

/** `credits` of GET me → view model; null when the API does not send credits yet. */
export function normalizeCredits(raw: unknown): Credits | null {
  const o = obj(raw);
  if (!o) return null;
  const b = obj(o.buckets) ?? {};
  const buckets = {
    plan: count(b.plan) ?? 0,
    bonus: count(b.bonus) ?? 0,
    purchased: count(b.purchased) ?? 0,
  };
  const sum = buckets.plan + buckets.bonus + buckets.purchased;
  const balance = count(o.balance) ?? sum;
  const c = obj(o.costs) ?? {};
  const cost = (k: ReviewTier) => {
    const n = count(c[k]);
    return n !== null && n > 0 ? n : DEFAULT_COSTS[k];
  };
  const out: Credits = {
    balance,
    buckets,
    costs: { quick: cost("quick"), deep: cost("deep"), team: cost("team") },
  };
  const expires = text(o.planExpiresAt);
  if (expires && Number.isFinite(Date.parse(expires)))
    out.planExpiresAt = expires;
  const welcome = welcomeOf(o.welcome);
  if (welcome) out.welcome = welcome;
  return out;
}

export function normalizePack(raw: unknown): CreditPack | null {
  const o = obj(raw);
  const id = o && text(o.id);
  const credits = o && count(o.credits);
  if (!o || !id || !credits) return null;
  const p = obj(o.prices) ?? {};
  const pack: CreditPack = {
    id,
    name: text(o.name) ?? id,
    credits,
    prices: { BRL: count(p.BRL) ?? 0, USD: count(p.USD) ?? 0 },
  };
  const badge = text(o.badge);
  if (badge) pack.badge = badge;
  return pack;
}
export function normalizePacks(raw: unknown): CreditPack[] {
  const list = Array.isArray(obj(raw)?.packs)
    ? (obj(raw)!.packs as unknown[])
    : Array.isArray(raw)
      ? raw
      : [];
  return list
    .map(normalizePack)
    .filter((p): p is CreditPack => !!p)
    .sort((a, b) => a.credits - b.credits);
}

export function normalizeLedger(raw: unknown): LedgerEntry[] {
  const list = Array.isArray(obj(raw)?.entries)
    ? (obj(raw)!.entries as unknown[])
    : [];
  return list.flatMap((e): LedgerEntry[] => {
    const o = obj(e);
    const id = o && text(o.id);
    const delta = o && finite(o.delta);
    const createdAt = o && text(o.createdAt);
    if (!o || !id || delta === null || !createdAt) return [];
    const entry: LedgerEntry = {
      id,
      delta: Math.round(delta),
      reason: text(o.reason) ?? "other",
      bucket: BUCKETS.find((b) => b === o.bucket) ?? null,
      createdAt,
    };
    const ref = text(o.ref);
    const note = text(o.note);
    if (ref) entry.ref = ref;
    if (note) entry.note = note;
    return [entry];
  });
}

/** Reads a 402 insufficient_credits error (ApiError with body). */
export function insufficientFrom(e: unknown): InsufficientCredits | null {
  const err = e as { status?: unknown; code?: unknown; body?: unknown } | null;
  if (!err || err.status !== 402) return null;
  const body = obj(err.body) ?? {};
  if ((err.code ?? body.code) !== "insufficient_credits") return null;
  const out: InsufficientCredits = {
    needed: count(body.needed),
    balance: count(body.balance),
    packs: normalizePacks({ packs: body.packs }),
  };
  const to = text(body.upgradeTo);
  if (to) out.upgradeTo = to;
  if (body.tier === "quick" || body.tier === "deep" || body.tier === "team")
    out.tier = body.tier;
  return out;
}

/** Cost of a review tier for this account (the API's costs win; Pro pays less for Deep). */
export function tierCost(
  credits: Credits | null,
  tier: ReviewTier,
  plan: { id: PlanId; limits?: { deepCost?: number | null } } | null,
) {
  if (credits) return credits.costs[tier];
  if (tier === "quick") return DEFAULT_COSTS.quick;
  if (tier === "team")
    return plan?.id === "pro" ? DEFAULT_COSTS.team - 1 : DEFAULT_COSTS.team;
  return (
    plan?.limits?.deepCost ?? (plan?.id === "pro" ? 2 : DEFAULT_COSTS.deep)
  );
}

/** Ledger reasons the UI knows; anything else shows as "Adjustment". */
export const REASON_LABELS: Record<string, string> = {
  welcome: "Welcome credit",
  plan_grant: "Monthly plan credits",
  plan_renewal: "Monthly plan credits",
  purchase: "Credit pack",
  review_quick: "Quick review",
  review_deep: "Deep review",
  review_team: "Team review",
  refund: "Refund",
  admin_adjust: "Adjustment by support",
  admin: "Adjustment by support",
  expire: "Plan credits expired",
  expiry: "Plan credits expired",
};
export const reasonLabel = (reason: string) =>
  REASON_LABELS[reason] ?? "Adjustment";

/** Days until a date (≥ 0); null when unknown or past. */
export function daysUntil(iso: string | undefined, now = Date.now()) {
  const at = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(at) || at <= now) return null;
  return Math.ceil((at - now) / 86400000);
}

/** Published packs, shown when the packs endpoint is unavailable (buying stays disabled). */
export const DEFAULT_PACKS: CreditPack[] = [
  {
    id: "starter",
    name: "Starter",
    credits: 10,
    prices: { BRL: 990, USD: 299 },
  },
  {
    id: "standard",
    name: "Standard",
    credits: 30,
    prices: { BRL: 2490, USD: 749 },
    badge: "popular",
  },
  {
    id: "pro-pack",
    name: "Pro pack",
    credits: 100,
    prices: { BRL: 6990, USD: 1999 },
    badge: "best_value",
  },
];
/** Price of one credit in cents (for "R$ 1,66 per credit"). */
export const perCredit = (p: CreditPack, c: Currency) =>
  p.credits > 0 ? Math.round(p.prices[c] / p.credits) : 0;
