import type { LiveCallRecord, Progress, Review } from "@/features/maps";
import { finite, text } from "@/shared/format";

/** The metrics followed match after match (all optional: render only what exists). */
export const JOURNEY_METRICS = [
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
] as const;
export type JourneyMetric = (typeof JOURNEY_METRICS)[number];
export type MetricValues = Partial<Record<JourneyMetric, number>>;

/** Older API field names of the same metrics. */
const ALIASES: Partial<Record<JourneyMetric, string[]>> = {
  hsPct: ["headshotPercentage", "hs"],
  tradedDeathsPct: ["tradedDeaths"],
  openingWinPct: ["openingSuccess"],
};

/** Metrics where a lower number is better. */
export const LOWER_IS_BETTER = new Set<JourneyMetric>([
  "crosshairMedianDeg",
  "isolatedDeathsPct",
]);

export type Candidate = {
  steamId: string;
  name: string;
  matches: number;
  reviews: number;
};
export type Identity = {
  status: "steam" | "chosen" | "missing";
  candidates: Candidate[];
};
export type PlanItemRef = {
  id: string;
  text: string;
  scope: "map" | "general";
  map: string | null;
  targetMetric: string | null;
  direction: "up" | "down" | null;
};
export type AdherenceStatus = "applied" | "partly" | "not_applied" | "unknown";
export type Adherence = {
  planItemId: string;
  text: string;
  fromAnalysisId: string | null;
  status: AdherenceStatus;
  metric: string | null;
  before: number | null;
  after: number | null;
};
export type NodeReview = {
  reviewId: string;
  tier: string | null;
  createdAt: string | null;
  verdict: string | null;
  planItems: PlanItemRef[];
};
export type JourneyNode = {
  analysisId: string;
  playedAt: string | null;
  map: string | null;
  result: { won: number; lost: number; win: boolean | null } | null;
  metrics: MetricValues;
  delta: MetricValues;
  review: NodeReview | null;
  adherence: Adherence[];
};
export type Journey = {
  identity: Identity;
  /** Oldest first. */
  timeline: JourneyNode[];
  maps: string[];
  adherenceRate: number | null;
  reviews: Review[];
  liveCalls: LiveCallRecord[];
  /** What the coach learned (older API; shown in the history section). */
  profile: Progress["profile"];
};

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function metricsOf(raw: Record<string, unknown>): MetricValues {
  const out: MetricValues = {};
  for (const k of JOURNEY_METRICS) {
    const v = [k, ...(ALIASES[k] ?? [])]
      .map((key) => finite(raw[key]))
      .find((x) => x !== null);
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

function planItem(raw: unknown, i: number): PlanItemRef | null {
  const o = typeof raw === "string" ? { text: raw } : obj(raw);
  const body = text(o.text);
  if (!body) return null;
  const dir = o.direction;
  return {
    id: text(o.id) ?? `p${i}`,
    text: body,
    scope: o.scope === "map" ? "map" : "general",
    map: text(o.map),
    targetMetric: text(o.targetMetric),
    direction: dir === "up" || dir === "down" ? dir : null,
  };
}

const STATUSES: AdherenceStatus[] = ["applied", "partly", "not_applied"];
function adherence(raw: unknown): Adherence | null {
  const o = obj(raw);
  const body = text(o.text);
  if (!body) return null;
  return {
    planItemId: text(o.planItemId) ?? body,
    text: body,
    fromAnalysisId: text(o.fromAnalysisId),
    status: STATUSES.find((s) => s === o.status) ?? "unknown",
    metric: text(o.metric),
    before: finite(o.before),
    after: finite(o.after),
  };
}

function resultOf(o: Record<string, unknown>): JourneyNode["result"] {
  const r = obj(o.result);
  const won = finite(r.roundsWon ?? o.roundsWon);
  const lost = finite(r.roundsLost ?? o.roundsLost);
  if (won === null || lost === null) return null;
  const flag = r.won;
  return {
    won,
    lost,
    win: typeof flag === "boolean" ? flag : won === lost ? null : won > lost,
  };
}

function reviewOf(raw: unknown): NodeReview | null {
  const o = obj(raw);
  const reviewId = text(o.reviewId) ?? text(o.id);
  if (!reviewId) return null;
  return {
    reviewId,
    tier: text(o.tier),
    createdAt: text(o.createdAt),
    verdict: text(o.verdict),
    planItems: arr(o.planItems)
      .map(planItem)
      .filter((p): p is PlanItemRef => !!p),
  };
}

function node(raw: unknown): JourneyNode | null {
  const o = obj(raw);
  const analysisId = text(o.analysisId);
  if (!analysisId) return null;
  const metrics = metricsOf({ ...o, ...obj(o.metrics) });
  return {
    analysisId,
    playedAt: text(o.playedAt) ?? text(o.date),
    map: text(o.map),
    result: resultOf(o),
    metrics,
    delta: metricsOf(obj(o.deltaVsPrevious)),
    review: reviewOf(o.review),
    adherence: arr(o.adherence)
      .map(adherence)
      .filter((a): a is Adherence => !!a),
  };
}

const time = (n: JourneyNode) => {
  const v = n.playedAt ? Date.parse(n.playedAt) : NaN;
  return Number.isFinite(v) ? v : 0;
};

/** Fills deltas the API did not send, comparing each match with the previous one. */
function withDeltas(list: JourneyNode[]) {
  return list.map((n, i) => {
    const prev = list[i - 1];
    if (!prev) return n;
    const delta: MetricValues = { ...n.delta };
    for (const k of JOURNEY_METRICS) {
      const a = prev.metrics[k];
      const b = n.metrics[k];
      if (delta[k] === undefined && a !== undefined && b !== undefined)
        delta[k] = b - a;
    }
    return { ...n, delta };
  });
}

function rate(raw: unknown, nodes: JourneyNode[]) {
  const v = finite(raw);
  if (v !== null) return Math.max(0, Math.min(100, v <= 1 ? v * 100 : v));
  const known = nodes.flatMap((n) =>
    n.adherence.filter((a) => a.status !== "unknown"),
  );
  if (!known.length) return null;
  const score = known.reduce(
    (s, a) =>
      s + (a.status === "applied" ? 1 : a.status === "partly" ? 0.5 : 0),
    0,
  );
  return (score / known.length) * 100;
}

function identityOf(o: Record<string, unknown>): Identity {
  const id = obj(o.identity);
  const status = id.status;
  const candidates = arr(id.candidates)
    .map((c): Candidate | null => {
      const x = obj(c);
      const steamId = text(x.steamId);
      if (!steamId) return null;
      return {
        steamId,
        name: text(x.name) ?? steamId,
        matches: finite(x.matches) ?? 0,
        reviews: finite(x.reviews) ?? 0,
      };
    })
    .filter((c): c is Candidate => !!c);
  if (status === "steam" || status === "chosen" || status === "missing")
    return { status, candidates };
  // Older API: only the tracked player id.
  const tracked = text(o.playerSteamId);
  return {
    status: tracked ? (o.linkedToSteam ? "steam" : "chosen") : "missing",
    candidates,
  };
}

/** GET coach/progress → the chronological journey (new and older API shapes). */
export function normalizeJourney(raw: unknown): Journey {
  const o = obj(raw);
  const timeline = withDeltas(
    arr(o.timeline)
      .map(node)
      .filter((n): n is JourneyNode => !!n)
      .sort((a, b) => time(a) - time(b)),
  );
  const maps = [
    ...new Set([
      ...arr(o.maps)
        .map((m) => (typeof m === "string" ? m : text(obj(m).map)))
        .filter((m): m is string => !!m),
      ...timeline.map((n) => n.map).filter((m): m is string => !!m),
    ]),
  ];
  return {
    identity: identityOf(o),
    timeline,
    maps,
    adherenceRate: rate(obj(o.summary).planAdherenceRate, timeline),
    reviews: arr(o.reviews) as Review[],
    liveCalls: arr(o.liveCalls) as LiveCallRecord[],
    profile:
      o.profile && typeof o.profile === "object"
        ? (o.profile as Progress["profile"])
        : null,
  };
}

/** First and last value of a metric over the given matches (oldest first). */
export function trendOf(nodes: JourneyNode[], key: JourneyMetric) {
  const values = nodes
    .map((n) => n.metrics[key])
    .filter((v): v is number => v !== undefined);
  if (!values.length) return null;
  const first = values[0]!;
  const last = values[values.length - 1]!;
  const change = last - first;
  const better = LOWER_IS_BETTER.has(key) ? -change : change;
  return {
    values,
    first,
    last,
    change,
    direction:
      values.length < 2 || Math.abs(change) < 1e-9
        ? ("flat" as const)
        : better > 0
          ? ("better" as const)
          : ("worse" as const),
  };
}

/** Tips checked on later matches: how many were applied (partly counts as half). */
export function adherenceCounts(nodes: JourneyNode[]) {
  const all = nodes.flatMap((n) => n.adherence);
  const known = all.filter((a) => a.status !== "unknown");
  return {
    applied: known.filter((a) => a.status === "applied").length,
    partly: known.filter((a) => a.status === "partly").length,
    checked: known.length,
    total: all.length,
  };
}

export type SummaryLine = {
  text: string;
  params: Record<string, number>;
  /** Decimal places for each numeric param. */
  digits: number;
};

/** The plain-language summary on top of the page (deterministic, from the numbers). */
export function summaryLines(nodes: JourneyNode[]): SummaryLine[] {
  const lines: SummaryLine[] = [];
  if (nodes.length >= 2) {
    const adr = trendOf(nodes, "adr");
    const kd = trendOf(nodes, "kd");
    if (adr && adr.values.length >= 2)
      lines.push({
        text: "Over your last {n} matches your ADR went from {from} to {to}.",
        params: { n: nodes.length, from: adr.first, to: adr.last },
        digits: 0,
      });
    else if (kd && kd.values.length >= 2)
      lines.push({
        text: "Over your last {n} matches your K/D went from {from} to {to}.",
        params: { n: nodes.length, from: kd.first, to: kd.last },
        digits: 2,
      });
  }
  const a = adherenceCounts(nodes);
  if (a.checked > 0)
    lines.push({
      text: "You applied {applied} of {checked} coach tips.",
      params: { applied: a.applied, checked: a.checked },
      digits: 0,
    });
  if (nodes.length === 1)
    lines.push({
      text: "Upload your next match to see if you applied the plan.",
      params: {},
      digits: 0,
    });
  return lines;
}
