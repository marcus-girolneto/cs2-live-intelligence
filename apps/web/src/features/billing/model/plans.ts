/**
 * Plans, prices and daily usage. All API data is normalised here; when the plans endpoint
 * is unavailable the published v1 catalogue below is shown instead.
 */
import { finite, text } from "@/shared/format";
import {
  type AccountPlan,
  type Counter,
  type Currency,
  type LimitFeature,
  type Plan,
  type PlanId,
  type PlanLimitError,
  type Price,
} from "./catalogue";
import { obj } from "./normalize";

export * from "./catalogue";
export {
  normalizeAccountPlan,
  normalizePlans,
  normalizeUsage,
  planUpdateBody,
} from "./normalize";

export const currencyFor = (lang: string): Currency =>
  lang === "pt" ? "BRL" : "USD";

export function formatPrice(cents: number, currency: Currency, locale: string) {
  return (cents / 100).toLocaleString(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
/** Months saved by paying yearly (2 for the v1 prices). */
export function freeMonths(price: Price) {
  if (!price.month || !price.year) return 0;
  return Math.max(0, Math.round((price.month * 12 - price.year) / price.month));
}

/** Remaining uses today: null = unlimited. */
export function remaining(c: Counter | undefined): number | null {
  if (!c || c.limit === null) return null;
  return Math.max(0, c.limit - c.used);
}
/** Time until the daily reset as {h, m}; null when unknown or past. */
export function resetsIn(resetsAt: string | undefined, now = Date.now()) {
  const at = resetsAt ? Date.parse(resetsAt) : NaN;
  if (!Number.isFinite(at) || at <= now) return null;
  const mins = Math.ceil((at - now) / 60000);
  return { h: Math.floor(mins / 60), m: mins % 60 };
}

const FEATURES: LimitFeature[] = [
  "ai_review",
  "live_ai",
  "upload",
  "clip_export",
];
/** Reads a 402 plan_limit error (ApiError with body) into a typed object. */
export function planLimitFrom(e: unknown): PlanLimitError | null {
  const err = e as { status?: unknown; code?: unknown; body?: unknown } | null;
  if (!err || err.status !== 402) return null;
  const body = obj(err.body) ?? {};
  if ((err.code ?? body.code) !== "plan_limit") return null;
  const feature = FEATURES.includes(body.feature as LimitFeature)
    ? (body.feature as LimitFeature)
    : "ai_review";
  const out: PlanLimitError = {
    feature,
    limit: body.limit === null ? null : finite(body.limit),
  };
  const resets = text(body.resetsAt);
  const to = text(body.upgradeTo);
  if (resets) out.resetsAt = resets;
  if (to) out.upgradeTo = to;
  return out;
}

/** The plan to pitch: the API's suggestion, else the next paid tier above the current one. */
export function upgradeTarget(
  plans: Plan[],
  current: PlanId | undefined,
  suggested?: PlanId,
  feature?: LimitFeature,
) {
  const paid = plans.filter((p) => p.active && p.prices.USD.month > 0);
  const hit = suggested && paid.find((p) => p.id === suggested);
  if (hit) return hit;
  const order = plans.map((p) => p.id);
  const above = paid.filter(
    (p) => order.indexOf(p.id) > order.indexOf(current ?? "free"),
  );
  const fits = above.filter((p) =>
    feature === "clip_export"
      ? p.limits.clipExport
      : feature === "live_ai"
        ? (p.limits.liveAiMatchesPerDay ?? 1) > 0
        : feature === "per_map"
          ? p.limits.perMapLearning
          : true,
  );
  return fits[0] ?? above[0] ?? paid.at(-1) ?? null;
}

export const isPaid = (plan: AccountPlan | null | undefined) =>
  !!plan && plan.id !== "free";

/** User-facing text for a failed checkout/portal call. */
export function checkoutErrorText(e: unknown) {
  const code = (e as { code?: unknown } | null)?.code;
  if (code === "billing_disabled")
    return "Coming soon — payments are being set up.";
  return e instanceof Error && e.message
    ? e.message
    : "Checkout is unavailable.";
}
