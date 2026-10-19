/**
 * View model for AI coach reviews. Every field from the API is optional and validated here,
 * so older reviews (no scores / key moments / drills / scope) render without gaps or NaN.
 */
import { parsePlan, scopeOf, type PlanItem, type Scope } from "@/features/maps";
import { parseClip, type ClipRef } from "@/features/replay";
import { finite, text } from "@/shared/format";
import { normalizeDeep, type DeepReview } from "./deep";

export { parseClip, type ClipRef } from "@/features/replay";
export { byScope, parsePlan, type PlanItem, type Scope } from "@/features/maps";

export const SCORE_KEYS = [
  "aim",
  "positioning",
  "utility",
  "trading",
  "economy",
  "impact",
] as const;
export type ScoreKey = (typeof SCORE_KEYS)[number];
export type CoachScore = {
  key: ScoreKey;
  value: number;
  label?: string;
  basis?: string;
};
export type KeyMoment = {
  eventId?: string;
  round: number | null;
  time: number | null;
  title: string;
  whatHappened?: string;
  whatToDoInstead?: string;
  kind: "mistake" | "highlight";
  clip?: ClipRef;
  scope: Scope;
};
export type CoachInsight = {
  observation: string;
  actionablePractice?: string;
  /** Why this costs rounds (newer reviews). */
  why?: string;
  evidenceIds: string[];
  confidence?: "low" | "medium" | "high";
  caveats: string[];
  kind: "strength" | "improve";
  scope: Scope;
  clips: ClipRef[];
};
export type Drill = {
  name: string;
  durationMinutes: number | null;
  howTo?: string;
  metric?: string;
  scope: Scope;
};
export type ReviewTier = "quick" | "deep";
export type CoachReview = {
  /** null for reviews written before review tiers existed (shown as Quick). */
  tier: ReviewTier | null;
  /** Deep-only sections (utility lab, crosshair, positioning, round table). */
  deep?: DeepReview;
  verdict?: string;
  summary?: string;
  map?: string;
  scores: CoachScore[];
  keyMoments: KeyMoment[];
  insights: CoachInsight[];
  drills: Drill[];
  plan: PlanItem[];
  caveats: string[];
};

const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strs = (v: unknown) =>
  arr(v)
    .map(text)
    .filter((s): s is string => s !== null);
const first = (o: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
};
const opt = <K extends string, V>(key: K, value: V | null | undefined) =>
  (value === null || value === undefined ? {} : { [key]: value }) as Partial<
    Record<K, V>
  >;

function parseScores(raw: unknown): CoachScore[] {
  const o = obj(raw);
  const list: { key: string; v: unknown }[] = o
    ? Object.entries(o).map(([key, v]) => ({ key, v }))
    : arr(raw).map((v) => ({ key: String(obj(v)?.key ?? ""), v }));
  const out: CoachScore[] = [];
  for (const { key, v } of list) {
    if (!(SCORE_KEYS as readonly string[]).includes(key)) continue;
    const s = obj(v);
    const value = finite(s ? first(s, ["value", "score"]) : v);
    if (value === null) continue;
    out.push({
      key: key as ScoreKey,
      value: Math.max(0, Math.min(100, value)),
      ...opt("label", s ? text(s.label) : null),
      ...opt("basis", s ? text(first(s, ["basis", "why", "reason"])) : null),
    });
  }
  return SCORE_KEYS.flatMap((k) => out.filter((s) => s.key === k).slice(0, 1));
}

function parseMoment(raw: unknown): KeyMoment | null {
  const o = obj(raw);
  if (!o) return null;
  const title = text(first(o, ["title", "headline"]));
  const whatHappened = text(first(o, ["whatHappened", "description"]));
  if (!title && !whatHappened) return null;
  const parsed = parseClip(o.clip);
  const time = finite(first(o, ["time", "t", "roundTime"]));
  const clip =
    parsed &&
    parsed.at === undefined &&
    time !== null &&
    time >= parsed.from &&
    time <= parsed.to
      ? { ...parsed, at: time }
      : parsed;
  const round = finite(o.round) ?? clip?.round ?? null;
  return {
    ...opt("eventId", text(o.eventId)),
    round,
    time,
    title: title ?? whatHappened!,
    ...opt("whatHappened", title ? whatHappened : null),
    ...opt("whatToDoInstead", text(first(o, ["whatToDoInstead", "instead"]))),
    kind: o.kind === "highlight" ? "highlight" : "mistake",
    ...opt("clip", clip),
    scope: scopeOf(o.scope),
  };
}

function parseInsight(raw: unknown): CoachInsight | null {
  const o = obj(raw);
  const observation = o && text(o.observation);
  if (!o || !observation) return null;
  const confidence = o.confidence;
  return {
    observation,
    ...opt("actionablePractice", text(o.actionablePractice)),
    ...opt("why", text(first(o, ["whyItMatters", "why", "impact"]))),
    evidenceIds: strs(o.evidenceIds),
    ...(confidence === "low" || confidence === "medium" || confidence === "high"
      ? { confidence }
      : {}),
    caveats: strs(o.caveats),
    kind: o.kind === "strength" ? "strength" : "improve",
    scope: scopeOf(o.scope),
    clips: arr(o.clips)
      .map(parseClip)
      .filter((c): c is ClipRef => !!c),
  };
}

function parseDrill(raw: unknown): Drill | null {
  const o = obj(raw);
  const name = o && text(first(o, ["name", "title"]));
  if (!o || !name) return null;
  const minutes = finite(first(o, ["durationMinutes", "minutes"]));
  return {
    name,
    durationMinutes: minutes !== null && minutes > 0 ? minutes : null,
    ...opt("howTo", text(first(o, ["howTo", "description"]))),
    ...opt("metric", text(o.metric)),
    scope: scopeOf(o.scope),
  };
}

export function normalizeCoaching(raw: unknown): CoachReview {
  const o = obj(raw) ?? {};
  const deep = normalizeDeep(o.deep);
  return {
    tier:
      o.tier === "deep" || o.tier === "quick" ? o.tier : deep ? "deep" : null,
    ...opt("deep", deep),
    ...opt("verdict", text(first(o, ["verdict", "headline"]))),
    ...opt("summary", text(o.summary)),
    ...opt("map", text(o.map)),
    scores: parseScores(o.scores),
    keyMoments: arr(o.keyMoments)
      .map(parseMoment)
      .filter((m): m is KeyMoment => !!m),
    insights: arr(o.insights)
      .map(parseInsight)
      .filter((i): i is CoachInsight => !!i),
    drills: arr(o.drills)
      .map(parseDrill)
      .filter((d): d is Drill => !!d),
    plan: parsePlan(o),
    caveats: strs(o.caveats),
  };
}

/** Rounded mean of the scores; null when there are none. */
export function overallScore(scores: CoachScore[]) {
  if (!scores.length) return null;
  return Math.round(scores.reduce((s, x) => s + x.value, 0) / scores.length);
}
