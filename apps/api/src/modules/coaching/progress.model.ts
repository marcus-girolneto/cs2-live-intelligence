/**
 * Chronological, plan-adherence-centred progress (pure; unit-tested). Every match of the
 * tracked player becomes a timeline entry with its metrics, the change versus the previous
 * entry, the review written for it (plan items with a target metric) and how the plan of the
 * latest earlier review was applied in this match.
 */
import type { Analysis, DeepReview, TargetMetric } from "@cs2/contracts";
import { planTarget, type Direction } from "@cs2/coaching";
import { onTargetPct } from "@cs2/contracts/crosshair";

export const PROGRESS_METRICS = [
  "adr",
  "kd",
  "kast",
  "hsPct",
  "accuracy",
  "tradedDeathsPct",
  "openingWinPct",
  "utilityDamagePerRound",
  "crosshairMedianDeg",
  "isolatedDeathsPct",
  "crosshairOnTargetPct",
] as const;
export type ProgressMetric = (typeof PROGRESS_METRICS)[number];
export type MetricValues = Partial<Record<ProgressMetric, number>>;

/** A meaningful change per metric (applied ≥ threshold, partly ≥ half of it). */
export const ADHERENCE_THRESHOLDS: Record<ProgressMetric, number> = {
  adr: 5,
  kd: 0.1,
  kast: 5,
  hsPct: 5,
  accuracy: 2,
  tradedDeathsPct: 10,
  openingWinPct: 10,
  utilityDamagePerRound: 3,
  crosshairMedianDeg: 1,
  isolatedDeathsPct: 10,
  crosshairOnTargetPct: 10,
};
/** Minimum sample (rounds, deaths, duels, shots...) for a metric to be judged in one match. */
export const MIN_SAMPLES: Record<ProgressMetric, number> = {
  adr: 8,
  kd: 8,
  kast: 8,
  hsPct: 5,
  accuracy: 50,
  tradedDeathsPct: 3,
  openingWinPct: 3,
  utilityDamagePerRound: 8,
  crosshairMedianDeg: 5,
  isolatedDeathsPct: 3,
  crosshairOnTargetPct: 5,
};

type Player = Analysis["players"][number];
type Metric = Player["kills"] | undefined;
const ok = (m: Metric): m is NonNullable<Metric> & { value: number } =>
  !!m && m.complete && m.value !== null && Number.isFinite(m.value);
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Metrics and their sample sizes for one player in one match (+ deep modules if reviewed). */
export function matchMetrics(
  player: Player,
  deep?: DeepReview,
): { values: MetricValues; samples: MetricValues } {
  const values: MetricValues = {};
  const samples: MetricValues = {};
  const rounds = player.rounds?.length ?? 0;
  const set = (k: ProgressMetric, v: number | null | undefined, n: number) => {
    if (v === null || v === undefined || !Number.isFinite(v)) return;
    values[k] = r2(v);
    samples[k] = n;
  };
  const adv = player.advanced ?? {};
  if (ok(player.adr)) set("adr", player.adr.value, rounds);
  if (ok(player.kills) && ok(player.deaths))
    set("kd", player.kills.value / Math.max(1, player.deaths.value), rounds);
  if (ok(adv.kast)) set("kast", adv.kast.value, rounds);
  if (ok(player.headshotPercentage))
    set(
      "hsPct",
      player.headshotPercentage.value,
      player.headshotPercentage.denominator,
    );
  if (ok(adv.accuracy))
    set("accuracy", adv.accuracy.value, adv.accuracy.denominator);
  const traded = adv["traded-deaths"];
  if (ok(traded)) set("tradedDeathsPct", traded.value, traded.denominator);
  const opening = adv["opening-success"];
  if (ok(opening)) set("openingWinPct", opening.value, opening.denominator);
  const util = adv["utility-damage-per-round"];
  if (ok(util)) set("utilityDamagePerRound", util.value, rounds);
  if (deep?.crosshair)
    set(
      "crosshairMedianDeg",
      deep.crosshair.medianOffset,
      deep.crosshair.measured,
    );
  if (deep?.crosshair)
    set(
      "crosshairOnTargetPct",
      onTargetPct(deep.crosshair.samples ?? []),
      deep.crosshair.measured,
    );
  if (deep?.positioning)
    set(
      "isolatedDeathsPct",
      deep.positioning.isolatedPct,
      deep.positioning.deaths,
    );
  return { values, samples };
}

export type JourneyMatch = {
  analysisId: string;
  createdAt: string;
  map: string | null;
  player: Player;
  /** Latest review of this match for the tracked player. */
  review?: {
    reviewId: string;
    tier: "quick" | "deep";
    createdAt: string;
    coaching: unknown;
  };
  /** coaching.deep of the latest deep review of this match, if any. */
  deep?: DeepReview;
};
export type PlanItemView = {
  id: string;
  text: string;
  scope: "map" | "general";
  map?: string;
  targetMetric: TargetMetric;
  direction: Direction;
};
export type AdherenceStatus = "applied" | "partly" | "not_applied" | "unknown";
export type AdherenceView = {
  planItemId: string;
  text: string;
  fromAnalysisId: string;
  status: AdherenceStatus;
  metric: TargetMetric;
  before: number | null;
  after: number | null;
  threshold: number | null;
};
export type TimelineEntry = {
  analysisId: string;
  playedAt: string;
  dateSource: "upload";
  map: string | null;
  result: {
    roundsWon: number | null;
    roundsLost: number | null;
    won: boolean | null;
  };
  metrics: MetricValues;
  deltaVsPrevious: MetricValues;
  review?: {
    reviewId: string;
    tier: "quick" | "deep";
    createdAt: string;
    verdict?: string;
    planItems: PlanItemView[];
  };
  adherence?: AdherenceView[];
};
type Trend = {
  slope: number;
  n: number;
  confidence: "low" | "medium" | "high";
};
export type JourneySummary = {
  matches: number;
  firstPlayedAt: string | null;
  lastPlayedAt: string | null;
  trend: Partial<Record<"adr" | "kd" | "kast" | "hsPct", Trend>>;
  planAdherenceRate: number | null;
  bestMatch: {
    analysisId: string;
    playedAt: string;
    map: string | null;
    adr: number;
  } | null;
  worstMatch: {
    analysisId: string;
    playedAt: string;
    map: string | null;
    adr: number;
  } | null;
  streak: { kind: "win" | "loss"; count: number } | null;
};

/** Plan items of a stored review (targets validated, or inferred for older reviews). */
export function planItemsView(
  reviewId: string,
  coaching: unknown,
  map: string | null,
): PlanItemView[] {
  const c = (coaching ?? {}) as { plan?: unknown; planItems?: unknown };
  const raw: Record<string, unknown>[] = Array.isArray(c.planItems)
    ? c.planItems.filter(
        (p): p is Record<string, unknown> =>
          typeof p === "object" && p !== null && typeof p.text === "string",
      )
    : (Array.isArray(c.plan) ? c.plan : [])
        .filter((p): p is string => typeof p === "string" && !!p.trim())
        .map((text) => ({ text, scope: "map" }));
  return raw.slice(0, 5).map((p, i) => {
    const scope = p.scope === "general" ? "general" : "map";
    const itemMap =
      scope === "map"
        ? ((p.map as string | undefined) ?? map ?? undefined)
        : undefined;
    return {
      id: `${reviewId}:${i}`,
      text: String(p.text).slice(0, 300),
      scope,
      ...(itemMap ? { map: itemMap } : {}),
      ...planTarget(String(p.text), p.targetMetric, p.direction),
    };
  });
}

/** One plan item judged on a later match. */
export function judge(
  item: PlanItemView,
  fromAnalysisId: string,
  before: { values: MetricValues; samples: MetricValues },
  after: { values: MetricValues; samples: MetricValues },
): AdherenceView {
  const base = {
    planItemId: item.id,
    text: item.text,
    fromAnalysisId,
    metric: item.targetMetric,
  };
  if (item.targetMetric === "none")
    return {
      ...base,
      status: "unknown",
      before: null,
      after: null,
      threshold: null,
    };
  const m = item.targetMetric;
  const b = before.values[m];
  const a = after.values[m];
  const threshold = ADHERENCE_THRESHOLDS[m];
  const small =
    (before.samples[m] ?? 0) < MIN_SAMPLES[m] ||
    (after.samples[m] ?? 0) < MIN_SAMPLES[m];
  if (b === undefined || a === undefined || small)
    return {
      ...base,
      status: "unknown",
      before: b ?? null,
      after: a ?? null,
      threshold,
    };
  const gain = (item.direction === "down" ? -1 : 1) * (a - b);
  const status: AdherenceStatus =
    gain >= threshold
      ? "applied"
      : gain >= threshold / 2
        ? "partly"
        : "not_applied";
  return { ...base, status, before: b, after: a, threshold };
}

/** Least-squares slope per match over the last (up to) 10 values. */
export function trendOf(values: number[]): Trend | undefined {
  const ys = values.slice(-10);
  const n = ys.length;
  if (n < 2) return undefined;
  const mx = (n - 1) / 2;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  ys.forEach((y, x) => {
    num += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  });
  return {
    slope: r2(den ? num / den : 0),
    n,
    confidence: n >= 8 ? "high" : n >= 4 ? "medium" : "low",
  };
}

function resultOf(player: Player): TimelineEntry["result"] {
  const rounds = player.rounds ?? [];
  if (!rounds.length || rounds.some((r) => r.won === undefined))
    return { roundsWon: null, roundsLost: null, won: null };
  const won = rounds.filter((r) => r.won).length;
  const lost = rounds.length - won;
  return {
    roundsWon: won,
    roundsLost: lost,
    won: won === lost ? null : won > lost,
  };
}

/** Timeline (oldest → newest) and summary of the tracked player's matches. */
export function buildJourney(matches: JourneyMatch[]): {
  timeline: TimelineEntry[];
  summary: JourneySummary;
} {
  const sorted = [...matches].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  const measured = sorted.map((m) => matchMetrics(m.player, m.deep));
  let lastReviewed: { index: number; items: PlanItemView[] } | undefined;
  const timeline: TimelineEntry[] = sorted.map((m, i) => {
    const metrics = measured[i]!;
    const previous = measured[i - 1];
    const delta: MetricValues = {};
    if (previous)
      for (const k of PROGRESS_METRICS) {
        const a = metrics.values[k];
        const b = previous.values[k];
        if (a !== undefined && b !== undefined) delta[k] = r2(a - b);
      }
    const adherence = lastReviewed
      ? lastReviewed.items
          .filter(
            (item) =>
              item.scope === "general" || item.map === (m.map ?? undefined),
          )
          .map((item) =>
            judge(
              item,
              sorted[lastReviewed!.index]!.analysisId,
              measured[lastReviewed!.index]!,
              metrics,
            ),
          )
      : undefined;
    const items = m.review
      ? planItemsView(m.review.reviewId, m.review.coaching, m.map)
      : [];
    const verdict = (m.review?.coaching as { verdict?: unknown } | undefined)
      ?.verdict;
    const entry: TimelineEntry = {
      analysisId: m.analysisId,
      playedAt: m.createdAt,
      dateSource: "upload",
      map: m.map,
      result: resultOf(m.player),
      metrics: metrics.values,
      deltaVsPrevious: delta,
      ...(m.review
        ? {
            review: {
              reviewId: m.review.reviewId,
              tier: m.review.tier,
              createdAt: m.review.createdAt,
              ...(typeof verdict === "string" ? { verdict } : {}),
              planItems: items,
            },
          }
        : {}),
      ...(adherence?.length ? { adherence } : {}),
    };
    if (items.length) lastReviewed = { index: i, items };
    return entry;
  });
  return { timeline, summary: summarize(timeline) };
}

function summarize(timeline: TimelineEntry[]): JourneySummary {
  const series = (k: "adr" | "kd" | "kast" | "hsPct") =>
    timeline
      .map((t) => t.metrics[k])
      .filter((v): v is number => v !== undefined);
  const trend: JourneySummary["trend"] = {};
  for (const k of ["adr", "kd", "kast", "hsPct"] as const) {
    const t = trendOf(series(k));
    if (t) trend[k] = t;
  }
  const judged = timeline
    .flatMap((t) => t.adherence ?? [])
    .filter((a) => a.status !== "unknown");
  const score = judged.reduce(
    (n, a) =>
      n + (a.status === "applied" ? 1 : a.status === "partly" ? 0.5 : 0),
    0,
  );
  const withAdr = timeline.filter((t) => t.metrics.adr !== undefined);
  const pick = (better: (a: number, b: number) => boolean) =>
    withAdr.reduce<TimelineEntry | undefined>(
      (best, t) =>
        !best || better(t.metrics.adr!, best.metrics.adr!) ? t : best,
      undefined,
    );
  const view = (t: TimelineEntry | undefined) =>
    t
      ? {
          analysisId: t.analysisId,
          playedAt: t.playedAt,
          map: t.map,
          adr: t.metrics.adr!,
        }
      : null;
  let streak: JourneySummary["streak"] = null;
  for (let i = timeline.length - 1; i >= 0; i--) {
    const won = timeline[i]!.result.won;
    if (won === null) break;
    const kind = won ? "win" : "loss";
    if (!streak) streak = { kind, count: 1 };
    else if (streak.kind === kind) streak.count++;
    else break;
  }
  return {
    matches: timeline.length,
    firstPlayedAt: timeline[0]?.playedAt ?? null,
    lastPlayedAt: timeline.at(-1)?.playedAt ?? null,
    trend,
    planAdherenceRate: judged.length ? r2(score / judged.length) : null,
    bestMatch: view(pick((a, b) => a > b)),
    worstMatch: withAdr.length > 1 ? view(pick((a, b) => a < b)) : null,
    streak,
  };
}
