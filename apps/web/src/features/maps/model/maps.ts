/**
 * Per-map grouping of progress and coaching plans. Uses the API's `maps` / `generalPlan`
 * when present and derives the same view from the timeline + reviews for older backends.
 */
import { finite, mapName, text } from "@/shared/format";
import { parsePlan, type PlanItem } from "./plan";
import {
  PROGRESS_METRICS,
  type LearnedMetric,
  type Progress,
  type TimelineEntry,
} from "./progress";

export type MapProgress = {
  map: string;
  matches: number;
  lastPlayedAt: string | null;
  metrics: Record<string, LearnedMetric>;
  recurring: { pattern: string; matches: number }[];
  openPlanItems: PlanItem[];
};

/** "de_mirage" (lower-case key) from any map value; null when unknown. */
export function mapKey(v: unknown): string | null {
  const s = text(v)?.toLowerCase();
  return s && /^[a-z0-9_]{2,40}$/.test(s) ? s : null;
}
export const mapLabel = (v: unknown) => mapName(v);

const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
const mean = (v: (number | null)[]) => {
  const x = v.filter((n): n is number => n !== null);
  return x.length ? x.reduce((a, b) => a + b, 0) / x.length : null;
};

/** Metrics learned from a list of matches (oldest first): overall vs the last 3. */
export function metricsOf(entries: TimelineEntry[]) {
  const out: Record<string, LearnedMetric> = {};
  for (const { key } of PROGRESS_METRICS) {
    const vals = entries.map((e) => {
      if (key !== "kd") return finite(e[key]);
      const k = finite(e.kills);
      const d = finite(e.deaths);
      return k !== null && d !== null && d > 0 ? k / d : null;
    });
    const known = vals.filter((v) => v !== null);
    out[key] = {
      overall: mean(vals),
      recent: mean(vals.slice(-3)),
      matches: known.length,
    };
  }
  return out;
}

function planItems(v: unknown): PlanItem[] {
  if (!Array.isArray(v)) return [];
  return parsePlan({ planItems: v });
}

/** Map of analysisId → map key, from the timeline. */
const analysisMaps = (p: Progress) =>
  new Map(p.timeline.map((e) => [e.analysisId, mapKey(e.map)]));

export function mapsOf(p: Progress | null): MapProgress[] {
  if (!p) return [];
  const raw = (p as Progress & { maps?: unknown }).maps;
  if (Array.isArray(raw) && raw.length) {
    return raw.flatMap((m): MapProgress[] => {
      const o = obj(m);
      const key = o && mapKey(o.map);
      if (!o || !key) return [];
      const metrics: Record<string, LearnedMetric> = {};
      for (const [k, v] of Object.entries(obj(o.metrics) ?? {})) {
        const x = obj(v);
        if (x)
          metrics[k] = {
            overall: finite(x.overall),
            recent: finite(x.recent),
            matches: finite(x.matches) ?? 0,
          };
      }
      return [
        {
          map: key,
          matches: finite(o.matches) ?? 0,
          lastPlayedAt: text(o.lastPlayedAt),
          metrics,
          recurring: (Array.isArray(o.recurring) ? o.recurring : []).flatMap(
            (r) => {
              const x = obj(r);
              const pattern = x && text(x.pattern);
              return pattern
                ? [{ pattern, matches: finite(x!.matches) ?? 0 }]
                : [];
            },
          ),
          openPlanItems: planItems(o.openPlanItems).map((i) => ({
            ...i,
            scope: "map" as const,
            map: key,
          })),
        },
      ];
    });
  }
  // Derived: group the timeline by map; open items from the latest review on that map.
  const groups = new Map<string, TimelineEntry[]>();
  for (const e of p.timeline) {
    const key = mapKey(e.map);
    if (key) groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const byAnalysis = analysisMaps(p);
  return [...groups.entries()]
    .map(([map, entries]) => {
      const review = p.reviews.find(
        (r) => byAnalysis.get(r.analysisId) === map,
      );
      return {
        map,
        matches: entries.length,
        lastPlayedAt: entries.at(-1)?.date ?? null,
        metrics: metricsOf(entries),
        recurring: [],
        openPlanItems: review
          ? parsePlan(obj(review.coaching))
              .filter((i) => i.scope === "map")
              .map((i) => ({ ...i, map }))
          : [],
      };
    })
    .sort((a, b) => b.matches - a.matches);
}

/** Plan items that apply to every map (API `generalPlan`, else the latest review's). */
export function generalPlanOf(p: Progress | null): PlanItem[] {
  if (!p) return [];
  const raw = (p as Progress & { generalPlan?: unknown }).generalPlan;
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(obj(raw)?.items)
      ? (obj(raw)!.items as unknown[])
      : null;
  if (list) return planItems(list).map((i) => ({ ...i, scope: "general" }));
  const latest = p.reviews[0];
  return latest
    ? parsePlan(obj(latest.coaching)).filter((i) => i.scope !== "map")
    : [];
}

/** General items + items for one map (null = all maps: general only). */
export function planFor(p: Progress | null, map: string | null) {
  const general = generalPlanOf(p);
  const key = mapKey(map);
  const specific = key
    ? (mapsOf(p).find((m) => m.map === key)?.openPlanItems ?? [])
    : [];
  return { general, map: specific };
}
