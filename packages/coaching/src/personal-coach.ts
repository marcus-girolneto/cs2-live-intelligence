/**
 * Personal Coach aggregates (deterministic): everything the long-term coach may cite, computed
 * from all of a player's analyses, deep reviews and earlier plans.
 */
import type { Analysis, CoachFact, DeepReview } from "@cs2/contracts";
import { HISTORY_METRICS } from "./deep/rounds.js";
import { learnProfile } from "./learn.js";
import { FILTERED, sanitizeUntrusted } from "./security.js";

export type CoachHistoryInput = {
  steamId: string;
  analyses: { id: string; createdAt: string; analysis: Analysis }[];
  deepReviews: { analysisId: string; createdAt: string; deep: DeepReview }[];
  /** Plan items of earlier reviews (newest first) with the review date. */
  plans: { createdAt: string; text: string; scope?: string; map?: string }[];
  ratings: number[];
  liveCalls: number;
};
export type CoachAggregates = {
  facts: CoachFact[];
  basedOnMatches: number;
  maps: string[];
  tendencies: string[];
  caveats: string[];
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

/** Learned metrics: label, unit and direction. */
export const COACH_METRICS: Record<
  string,
  { label: string; unit: string; better: "higher" | "lower" }
> = {
  adr: { label: "ADR", unit: "", better: "higher" },
  kd: { label: "K/D", unit: "", better: "higher" },
  headshotPercentage: { label: "Headshot kills", unit: "%", better: "higher" },
  kast: { label: "KAST", unit: "%", better: "higher" },
  openingSuccess: { label: "Opening duels won", unit: "%", better: "higher" },
  tradedDeaths: { label: "Deaths traded", unit: "%", better: "higher" },
  survival: { label: "Rounds survived", unit: "%", better: "higher" },
  adrCT: { label: "ADR on CT", unit: "", better: "higher" },
  adrT: { label: "ADR on T", unit: "", better: "higher" },
};
/** Plan-item keywords → the learned metric that measures them (plan adherence). */
const PLAN_METRICS: [RegExp, string][] = [
  [/\btrad(e|ing)|troca|refrag/i, "tradedDeaths"],
  [/\bopening|entry|first (duel|contact|peek)|abertura/i, "openingSuccess"],
  [/\bhead ?shot|aim|mira|crosshair|tap|burst/i, "headshotPercentage"],
  [/\bsurviv|die|death|morr|sobreviv|alone|sozinho|isolat/i, "survival"],
  [/\bimpact|kast|damage|dano|adr\b/i, "adr"],
];

function factOf(
  id: string,
  key: string,
  value: number | null,
  trend: number | null,
  matches: number,
  map?: string,
): CoachFact | undefined {
  const m = COACH_METRICS[key];
  if (!m || value === null || !Number.isFinite(value)) return undefined;
  return {
    id,
    label: map ? `${m.label} on ${map}` : m.label,
    value: r1(value),
    unit: m.unit,
    trend: trend === null || !Number.isFinite(trend) ? null : r1(trend),
    better: m.better,
    matches,
    ...(map ? { map } : {}),
  };
}

/** Mean of a learned metric over analyses in [from, to). */
function metricBetween(
  input: CoachHistoryInput,
  key: string,
  from: number,
  to: number,
): { value: number | null; matches: number } {
  const own = input.analyses.filter((a) => {
    const t = Date.parse(a.createdAt);
    return t >= from && t < to;
  });
  const profile = learnProfile(own, input.steamId);
  const metric = profile?.metrics[key];
  return { value: metric?.overall ?? null, matches: metric?.matches ?? 0 };
}

/** All aggregates of the player's history (ids are stable per metric/map/plan). */
export function buildCoachAggregates(
  input: CoachHistoryInput,
): CoachAggregates {
  const profile = learnProfile(input.analyses, input.steamId);
  const facts: (CoachFact | undefined)[] = [];
  const caveats: string[] = [];
  if (!profile) {
    caveats.push("No analyzed match contains this player yet.");
    return { facts: [], basedOnMatches: 0, maps: [], tendencies: [], caveats };
  }
  for (const [key, m] of Object.entries(profile.metrics))
    facts.push(
      factOf(
        `overall-${key}`,
        key,
        m.overall,
        m.recent !== null && m.overall !== null ? m.recent - m.overall : null,
        m.matches,
      ),
    );
  profile.recurring.slice(0, 6).forEach((r) =>
    facts.push({
      id: `pattern-${slug(r.pattern)}`,
      label: `Recurring: ${r.pattern}`,
      value: r.matches,
      unit: "matches",
      trend: null,
      better: null,
      matches: profile.matches,
    }),
  );
  const maps = Object.entries(profile.perMap ?? {})
    .sort((a, b) => b[1].matches - a[1].matches)
    .slice(0, 6);
  for (const [map, p] of maps) {
    for (const key of ["adr", "kast", "openingSuccess", "tradedDeaths"])
      facts.push(
        factOf(
          `map-${slug(map)}-${key}`,
          key,
          p.metrics[key]?.overall ?? null,
          p.metrics[key]?.recent !== null &&
            p.metrics[key]?.overall !== null &&
            p.metrics[key]
            ? p.metrics[key]!.recent! - p.metrics[key]!.overall!
            : null,
          p.metrics[key]?.matches ?? 0,
          map,
        ),
      );
    const worst = [...p.places].sort((a, b) => b.deaths - a.deaths)[0];
    if (worst && worst.deaths >= 3)
      facts.push({
        id: `map-${slug(map)}-deaths-${slug(worst.place)}`,
        label: `Deaths at ${worst.place} on ${map}`,
        value: worst.deaths,
        unit: "deaths",
        trend: null,
        better: "lower",
        matches: worst.matches,
        map,
      });
  }
  // Deep modules over time: latest half vs earlier half of the deep reviews.
  const deep = [...input.deepReviews].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
  for (const m of HISTORY_METRICS) {
    const values = deep
      .map((d) => m.value(d.deep))
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (!values.length) continue;
    const half = Math.floor(values.length / 2);
    const early = mean(values.slice(0, half));
    const late = mean(values.slice(half))!;
    facts.push({
      id: `deep-${m.key}`,
      label: m.label,
      value: r1(late),
      unit: m.unit === "°" ? "deg" : m.unit,
      trend: early === null ? null : r1(late - early),
      better: m.better,
      matches: values.length,
    });
  }
  if (!deep.length)
    caveats.push(
      "No deep reviews yet: crosshair, utility and positioning trends are unavailable.",
    );
  // Plan adherence: did the metric tied to an earlier plan item improve after it was given?
  const seen = new Set<string>();
  for (const plan of input.plans) {
    // Earlier model outputs are untrusted (second-order injection): skip instruction-like ones.
    if (sanitizeUntrusted(plan.text, 300) === FILTERED) continue;
    const key = PLAN_METRICS.find(([re]) => re.test(plan.text))?.[1];
    if (!key || seen.has(`${key}|${plan.text}`) || seen.size >= 6) continue;
    seen.add(`${key}|${plan.text}`);
    const at = Date.parse(plan.createdAt);
    const before = metricBetween(input, key, 0, at);
    const after = metricBetween(input, key, at, Infinity);
    if (before.value === null || after.value === null || after.matches < 1)
      continue;
    const m = COACH_METRICS[key]!;
    facts.push({
      id: `plan-${seen.size}-${key}`,
      label: `${m.label} after the plan "${plan.text.slice(0, 80)}"`,
      value: r1(after.value),
      unit: m.unit,
      trend: r1(after.value - before.value),
      better: m.better,
      matches: after.matches,
    });
  }
  if (input.ratings.length)
    facts.push({
      id: "reviews-rating",
      label: "Your average rating of the coach's reviews (1-5)",
      value: r1(mean(input.ratings)!),
      unit: "",
      trend: null,
      better: "higher",
      matches: input.ratings.length,
    });
  facts.push({
    id: "activity-matches",
    label: "Analyzed matches",
    value: profile.matches,
    unit: "matches",
    trend: null,
    better: null,
    matches: profile.matches,
  });
  if (input.liveCalls)
    facts.push({
      id: "activity-live-calls",
      label: "Live AI calls received",
      value: input.liveCalls,
      unit: "calls",
      trend: null,
      better: null,
      matches: profile.matches,
    });
  if (profile.matches < 5)
    caveats.push(
      "Fewer than 5 analyzed matches: treat trends as early signals.",
    );
  return {
    facts: facts.filter((f): f is CoachFact => !!f).slice(0, 120),
    basedOnMatches: profile.matches,
    maps: maps.map(([m]) => m),
    tendencies: profile.tendencies.slice(0, 6),
    caveats,
  };
}
