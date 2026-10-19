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
};

const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
/** A string, or a list of strings joined — evidence/notes arrive in both shapes. */
function lines(v: unknown): string[] {
  if (typeof v === "string") return v.trim() ? [v.trim()] : [];
  return arr(v)
    .map((x) => text(x) ?? text(obj(x)?.text) ?? text(obj(x)?.note))
    .filter((s): s is string => s !== null);
}
const date = (v: unknown) =>
  typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : null;

function points(v: unknown): Point[] {
  return arr(v)
    .map((x): Point | null => {
      if (typeof x === "string")
        return x.trim() ? { text: x, evidence: null } : null;
      const o = obj(x);
      const t = text(o?.text) ?? text(o?.title);
      if (!o || !t) return null;
      const ev = lines(o.evidence);
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

function focusAreas(v: unknown): FocusArea[] {
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
        targetMetric: text(o.targetMetric) ?? text(o.metric),
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

/** One generated plan; null when it has nothing to show. */
export function normalizePersonalPlan(raw: unknown): PersonalPlan | null {
  const o = obj(raw);
  if (!o) return null;
  const plan: PersonalPlan = {
    headline: text(o.headline) ?? "",
    workingWell: points(o.workingWell),
    notWorking: points(o.notWorking),
    focusAreas: focusAreas(o.focusAreas),
    weeklyProgram: program(o.weeklyProgram),
    perMap: perMap(o.perMap),
    nextReviewSuggestion: text(o.nextReviewSuggestion),
    generatedAt: date(o.generatedAt),
    basedOnMatches: finite(o.basedOnMatches),
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
  // POST generate may answer with the plan itself instead of the envelope.
  const latestRaw = o.latest ?? (o.headline !== undefined ? o : null);
  return {
    latest: normalizePersonalPlan(latestRaw),
    history: arr(o.history)
      .map((x, i): PersonalHistoryItem | null => {
        const h = obj(x);
        const headline = text(h?.headline);
        if (!h || !headline) return null;
        return {
          id: text(h.id) ?? `h${i}`,
          generatedAt: date(h.generatedAt),
          headline,
        };
      })
      .filter((h): h is PersonalHistoryItem => h !== null),
    nextAllowedAt: date(o.nextAllowedAt),
  };
}

/** True while the regenerate cooldown is running. */
export const coolingDown = (s: PersonalState, now = Date.now()) =>
  !!s.nextAllowedAt && Date.parse(s.nextAllowedAt) > now;
