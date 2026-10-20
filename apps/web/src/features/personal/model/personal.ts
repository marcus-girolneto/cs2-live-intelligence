/** Personal Coach (Pro): a plan written from all of a player's matches. Pure mappers. */
import { finite, text } from "@/shared/format";

export type Point = { text: string; evidence: string | null };
export type FocusArea = {
  area: string;
  why: string | null;
  targetMetric: string | null;
  current: number | null;
  target: number | null;
  /** 0–100 progress from current toward target (direction-aware), null when unknown. */
  progress: number | null;
};
export type Drill = {
  id: string;
  name: string;
  minutesPerDay: number | null;
  howTo: string | null;
};
export type ProgramWeek = { week: number; goals: string[]; drills: Drill[] };
export type MapNote = { map: string; notes: string[] };
export type PersonalPlan = {
  headline: string;
  workingWell: Point[];
  notWorking: Point[];
  focusAreas: FocusArea[];
  weeklyProgram: ProgramWeek[];
  perMap: MapNote[];
  nextReviewSuggestion: string | null;
  generatedAt: string | null;
  basedOnMatches: number | null;
  caveats: string[];
};
export type PersonalHistoryItem = {
  id: string;
  generatedAt: string | null;
  headline: string;
};
export type PersonalState = {
  latest: PersonalPlan | null;
  history: PersonalHistoryItem[];
  nextAllowedAt: string | null;
  analyzedMatches: number | null;
  newMatchesSinceLast: number | null;
  /** The plan rewrites itself after this many new matches (null = unknown). */
  autoRegenerateAfterMatches: number | null;
};
/** 402 plan_required teaser: real counts for the locked screen. */
export type PersonalTeaserCounts = {
  analyzedMatches: number | null;
  reviews: number | null;
  plansGiven: number | null;
};
/** Fact ids the plan cites → readable "label: value" evidence. */
type Facts = Map<string, string>;

const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
/** A string, or a list of strings joined. Evidence and notes arrive in both shapes. */
function lines(v: unknown): string[] {
  if (typeof v === "string") return v.trim() ? [v.trim()] : [];
  return arr(v)
    .map((x) => text(x) ?? text(obj(x)?.text) ?? text(obj(x)?.note))
    .filter((s): s is string => s !== null);
}
const date = (v: unknown) =>
  typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : null;

function factsOf(v: unknown): Facts {
  const out: Facts = new Map();
  for (const x of arr(v)) {
    const f = obj(x);
    const id = text(f?.id);
    const label = text(f?.label);
    const value = finite(f?.value);
    if (!f || !id || !label) continue;
    const shown =
      value === null
        ? label
        : `${label}: ${Number.isInteger(value) ? value : value.toFixed(1)}${text(f.unit) ?? ""}`;
    out.set(id, text(f.map) ? `${shown} (${text(f.map)})` : shown);
  }
  return out;
}

function points(v: unknown, facts: Facts): Point[] {
  return arr(v)
    .map((x): Point | null => {
      if (typeof x === "string")
        return x.trim() ? { text: x, evidence: null } : null;
      const o = obj(x);
      const t = text(o?.text) ?? text(o?.title);
      if (!o || !t) return null;
      // Evidence cites fact ids; unknown ids are dropped, plain strings are kept.
      const ev = lines(o.evidence)
        .map((id) => facts.get(id) ?? (facts.size ? null : id))
        .filter((e): e is string => !!e);
      return { text: t, evidence: ev.length ? ev.join(" · ") : null };
    })
    .filter((p): p is Point => p !== null);
}

/** How far `current` has come toward `target` (works for lower-is-better too). */
export function focusProgress(
  current: number | null,
  target: number | null,
): number | null {
  if (current === null || target === null) return null;
  if (current === target) return 100;
  if (target > current)
    return target > 0 ? clamp((current / target) * 100) : null;
  return current > 0 ? clamp((target / current) * 100) : null;
}
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function focusAreas(v: unknown, facts: Facts): FocusArea[] {
  return arr(v)
    .map((x): FocusArea | null => {
      const o = obj(x);
      const area = text(o?.area) ?? text(o?.title);
      if (!o || !area) return null;
      const current = finite(o.current);
      const target = finite(o.target);
      return {
        area,
        why: text(o.why),
        targetMetric: metricLabel(
          text(o.targetMetric) ?? text(o.metric),
          facts,
        ),
        current,
        target,
        progress: focusProgress(current, target),
      };
    })
    .filter((f): f is FocusArea => f !== null);
}

function program(v: unknown): ProgramWeek[] {
  return arr(v)
    .map((x, i): ProgramWeek | null => {
      const o = obj(x);
      if (!o) return null;
      const week = finite(o.week) ?? i + 1;
      const drills = arr(o.drills)
        .map((d, j): Drill | null => {
          const dd = obj(d);
          const name = typeof d === "string" ? text(d) : text(dd?.name);
          if (!name) return null;
          return {
            id: `w${week}-${j}`,
            name,
            minutesPerDay: finite(dd?.minutesPerDay ?? dd?.minutes),
            howTo: text(dd?.howTo),
          };
        })
        .filter((d): d is Drill => d !== null);
      const goals = lines(o.goals);
      return goals.length || drills.length ? { week, goals, drills } : null;
    })
    .filter((w): w is ProgramWeek => w !== null)
    .sort((a, b) => a.week - b.week);
}

function perMap(v: unknown): MapNote[] {
  return arr(v)
    .map((x): MapNote | null => {
      const o = obj(x);
      const map = text(o?.map);
      const notes = lines(o?.notes ?? o?.note);
      return map && notes.length ? { map, notes } : null;
    })
    .filter((m): m is MapNote => m !== null);
}

/** The fact's label without its value ("Traded deaths %"), else the raw metric name. */
function metricLabel(id: string | null, facts: Facts) {
  if (!id) return null;
  const f = facts.get(id);
  return f ? (f.split(":")[0] ?? f) : id;
}

/** One generated plan; null when it has nothing to show. */
export function normalizePersonalPlan(
  raw: unknown,
  createdAt?: unknown,
): PersonalPlan | null {
  const o = obj(raw);
  if (!o) return null;
  const facts = factsOf(o.facts);
  const plan: PersonalPlan = {
    headline: text(o.headline) ?? "",
    workingWell: points(o.workingWell, facts),
    notWorking: points(o.notWorking, facts),
    focusAreas: focusAreas(o.focusAreas, facts),
    weeklyProgram: program(o.weeklyProgram),
    perMap: perMap(o.perMap),
    nextReviewSuggestion: text(o.nextReviewSuggestion),
    generatedAt: date(o.generatedAt) ?? date(createdAt),
    basedOnMatches: finite(o.basedOnMatches),
    caveats: lines(o.caveats).slice(0, 8),
  };
  const empty =
    !plan.headline &&
    !plan.workingWell.length &&
    !plan.notWorking.length &&
    !plan.focusAreas.length &&
    !plan.weeklyProgram.length;
  return empty ? null : plan;
}

/** GET coach/personal → latest plan, history and the regenerate cooldown. */
export function normalizePersonal(raw: unknown): PersonalState {
  const o = obj(raw) ?? {};
  // {latest: {id, createdAt, trigger, plan}}; older shapes put the plan itself in latest.
  const latest = obj(o.latest);
  const latestRaw =
    obj(latest?.plan) ?? latest ?? (o.headline !== undefined ? o : null);
  return {
    latest: normalizePersonalPlan(latestRaw, latest?.createdAt),
    history: arr(o.history)
      .map((x, i): PersonalHistoryItem | null => {
        const h = obj(x);
        const headline = text(h?.headline);
        if (!h || !headline) return null;
        return {
          id: text(h.id) ?? `h${i}`,
          generatedAt: date(h.generatedAt) ?? date(h.createdAt),
          headline,
        };
      })
      .filter((h): h is PersonalHistoryItem => h !== null),
    nextAllowedAt: date(o.nextAvailableAt) ?? date(o.nextAllowedAt),
    analyzedMatches: finite(o.analyzedMatches),
    newMatchesSinceLast: finite(o.newMatchesSinceLast),
    autoRegenerateAfterMatches: finite(o.autoRegenerateAfterMatches),
  };
}

export const EMPTY_PERSONAL: PersonalState = {
  latest: null,
  history: [],
  nextAllowedAt: null,
  analyzedMatches: null,
  newMatchesSinceLast: null,
  autoRegenerateAfterMatches: null,
};

/** The counts a 402 plan_required carries for the locked teaser. */
export function teaserFrom(e: unknown): PersonalTeaserCounts | null {
  const err = e as { status?: unknown; body?: unknown } | null;
  if (!err || err.status !== 402) return null;
  const t = obj(obj(err.body)?.teaser);
  if (!t) return null;
  return {
    analyzedMatches: finite(t.analyzedMatches),
    reviews: finite(t.reviews),
    plansGiven: finite(t.plansGiven),
  };
}

/** Generate errors the screen explains in its own words. */
export function generateErrorMessage(e: unknown): string | null {
  const code = (e as { code?: unknown } | null)?.code;
  if (code === "personal_coach_cooldown")
    return "Your plan was written recently. A new one unlocks soon.";
  if (code === "not_enough_data")
    return "Your Personal Coach needs a few more analyzed matches first.";
  return null;
}

/** True while the regenerate cooldown is running. */
export const coolingDown = (s: PersonalState, now = Date.now()) =>
  !!s.nextAllowedAt && Date.parse(s.nextAllowedAt) > now;
