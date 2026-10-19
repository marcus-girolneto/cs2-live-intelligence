/** DTO → view-model mappers for plans, usage and the account plan (all fields validated). */
import { finite, text } from "@/shared/format";
import {
  DEFAULT_PLANS,
  type AccountPlan,
  type Counter,
  type Currency,
  type Plan,
  type PlanLimits,
  type Price,
  type Usage,
} from "./catalogue";

export const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
const limit = (v: unknown, fallback: number | null) =>
  v === null ? null : (finite(v) ?? fallback);
const cents = (v: unknown, fallback: number) => {
  const n = finite(v);
  return n !== null && n >= 0 ? Math.round(n) : fallback;
};

/** Body of PUT admin/plans for one plan (API field names). */
export function planUpdateBody(p: Plan) {
  return {
    id: p.id,
    name: p.name,
    prices: p.prices,
    limits: {
      aiReviewsPerDay: p.limits.aiReviewsPerDay,
      liveAiMatchesPerDay: p.limits.liveAiMatchesPerDay,
      uploadsPerDay: p.limits.uploadsPerDay,
      retentionDaysMax: p.limits.retentionDays,
      monthlyCredits: p.limits.monthlyCredits ?? 0,
    },
    features: {
      clipExport: p.limits.clipExport,
      perMapLearning: p.limits.perMapLearning,
      monthlyReport: p.limits.monthlyReport,
      cheaperDeep: p.limits.cheaperDeep,
      reel: p.limits.matchReel,
      deepHistory: p.limits.historyCompare,
      priorityQueue: p.limits.priorityQueue,
    },
    active: p.active,
  };
}

export function normalizePlans(raw: unknown): Plan[] {
  const list = Array.isArray(obj(raw)?.plans)
    ? (obj(raw)!.plans as unknown[])
    : Array.isArray(raw)
      ? raw
      : [];
  const plans = list.flatMap((p): Plan[] => {
    const o = obj(p);
    const id = o && text(o.id);
    if (!o || !id) return [];
    const base = DEFAULT_PLANS.find((d) => d.id === id) ?? DEFAULT_PLANS[0]!;
    const prices = obj(o.prices) ?? {};
    const price = (c: Currency): Price => {
      const x = obj(prices[c]) ?? {};
      return {
        month: cents(x.month, base.prices[c].month),
        year: cents(x.year, base.prices[c].year),
      };
    };
    return [
      {
        id,
        name: text(o.name) ?? base.name,
        prices: { BRL: price("BRL"), USD: price("USD") },
        limits: limitsOf(o, base.limits),
        active: o.active !== false,
      },
    ];
  });
  return plans.length ? plans : DEFAULT_PLANS;
}

/** API limits ({…, retentionDaysMax}) + features ({clipExport, perMapLearning}). */
function limitsOf(o: Record<string, unknown>, base: PlanLimits): PlanLimits {
  const l = obj(o.limits) ?? {};
  const f = obj(o.features) ?? l;
  /** GET plans `credits` ({monthly, quickCost, deepCost}). */
  const c = obj(o.credits) ?? {};
  const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  return {
    aiReviewsPerDay: limit(l.aiReviewsPerDay, base.aiReviewsPerDay),
    liveAiMatchesPerDay: limit(l.liveAiMatchesPerDay, base.liveAiMatchesPerDay),
    uploadsPerDay: limit(l.uploadsPerDay, base.uploadsPerDay),
    retentionDays: limit(
      l.retentionDaysMax !== undefined ? l.retentionDaysMax : l.retentionDays,
      base.retentionDays,
    ),
    clipExport: bool(f.clipExport, base.clipExport),
    perMapLearning: bool(f.perMapLearning, base.perMapLearning),
    monthlyCredits: limit(l.monthlyCredits ?? c.monthly, base.monthlyCredits),
    deepCost: limit(
      c.deepCost ?? l.deepCost,
      typeof f.cheaperDeep === "boolean"
        ? f.cheaperDeep
          ? 2
          : 3
        : base.deepCost,
    ),
    cheaperDeep: bool(f.cheaperDeep, base.cheaperDeep),
    personalCoach: bool(f.personalCoach, base.personalCoach),
    monthlyReport: bool(f.monthlyReport, base.monthlyReport),
    matchReel: bool(f.reel ?? f.matchReel, base.matchReel),
    historyCompare: bool(
      f.deepHistory ?? f.historyCompare,
      base.historyCompare,
    ),
    priorityQueue: bool(f.priorityQueue, base.priorityQueue),
  };
}

const counter = (v: unknown): Counter | undefined => {
  const o = obj(v);
  const used = o && finite(o.used);
  if (!o || used === null) return undefined;
  return {
    used: Math.max(0, used),
    limit: o.limit === null ? null : finite(o.limit),
  };
};
export function normalizeUsage(raw: unknown): Usage | null {
  const o = obj(raw);
  if (!o) return null;
  const u: Usage = {};
  const day = text(o.day);
  const resetsAt = text(o.resetsAt);
  if (day) u.day = day;
  if (resetsAt) u.resetsAt = resetsAt;
  const ai = counter(o.aiReviews);
  const live = counter(o.liveAiMatches);
  const up = counter(o.uploads);
  if (ai) u.aiReviews = ai;
  if (live) u.liveAiMatches = live;
  if (up) u.uploads = up;
  return u;
}
export function normalizeAccountPlan(raw: unknown): AccountPlan | null {
  const o = obj(raw);
  const id = o && text(o.id);
  if (!o || !id) return null;
  const p: AccountPlan = {
    id,
    name: text(o.name) ?? DEFAULT_PLANS.find((d) => d.id === id)?.name ?? id,
  };
  for (const k of ["status", "renewsAt", "source"] as const) {
    const v = text(o[k]);
    if (v) p[k] = v;
  }
  if (obj(o.limits) || obj(o.features)) {
    const base = DEFAULT_PLANS.find((d) => d.id === id) ?? DEFAULT_PLANS[0]!;
    p.limits = limitsOf(o, base.limits);
  }
  return p;
}
