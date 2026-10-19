/**
 * Monthly performance report (Pro): DTO → view model. Every field is optional and validated
 * so a partial report renders without gaps, NaN or "undefined".
 */
import { finite, text } from "@/shared/format";

export type SeriesPoint = { label: string; value: number };
export type Series = {
  key: string;
  label: string;
  unit: string;
  better: "higher" | "lower";
  points: SeriesPoint[];
};
export type MapRow = {
  map: string;
  matches: number | null;
  winRate: number | null;
  adr: number | null;
  kd: number | null;
};
export type Recurring = {
  title: string;
  count: number | null;
  trend: "better" | "worse" | "same" | null;
  tip?: string;
};
export type MatchCard = {
  analysisId: string | null;
  matchId: string | null;
  map: string | null;
  date: string | null;
  kills: number | null;
  deaths: number | null;
  adr: number | null;
  score: number | null;
  headline?: string;
};
export type Evolution = { summary?: string; series: Series[] };
export type ReportSummary = {
  matches: number | null;
  rounds: number | null;
  winRate: number | null;
  adr: number | null;
  kd: number | null;
  rating: number | null;
  headline?: string;
};
export type Report = {
  id: string;
  period: string;
  createdAt: string | null;
  summary: ReportSummary;
  trends: Series[];
  perMap: MapRow[];
  recurring: Recurring[];
  utility: Evolution | null;
  crosshair: Evolution | null;
  bestMatch: MatchCard | null;
  worstMatch: MatchCard | null;
  plan: string[];
  narrative: string[];
};
export type ReportListItem = {
  id: string;
  period: string;
  createdAt: string | null;
  summary: ReportSummary;
};

const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const first = (o: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
};
const num = (o: Record<string, unknown>, keys: string[]) =>
  finite(first(o, keys));
const pct = (v: unknown) => {
  const n = finite(v);
  if (n === null) return null;
  return Math.max(0, Math.min(100, n > 0 && n < 1 ? n * 100 : n));
};

/** "2026-10" → a label in the viewer's locale ("October 2026"); anything else as is. */
export function periodLabel(period: string, locale = "en-US") {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 15));
  return d.toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
function periodOf(v: unknown): string {
  const o = obj(v);
  if (o) return text(first(o, ["label", "month", "from"])) ?? "";
  return text(v) ?? "";
}

const KNOWN: Record<
  string,
  { label: string; unit: string; better: "higher" | "lower" }
> = {
  adr: { label: "ADR", unit: "", better: "higher" },
  kast: { label: "KAST", unit: "%", better: "higher" },
  kd: { label: "K/D", unit: "", better: "higher" },
  rating: { label: "Rating", unit: "", better: "higher" },
  headshotPercentage: { label: "Headshot %", unit: "%", better: "higher" },
  hs: { label: "Headshot %", unit: "%", better: "higher" },
  winRate: { label: "Win rate", unit: "%", better: "higher" },
  efficiency: { label: "Utility efficiency", unit: "%", better: "higher" },
  enemiesFlashed: {
    label: "Enemies flashed / match",
    unit: "",
    better: "higher",
  },
  utilityDamage: {
    label: "Utility damage / match",
    unit: "",
    better: "higher",
  },
  medianOffset: { label: "Pre-aim offset", unit: "°", better: "lower" },
  wellPreAimed: { label: "Duels well pre-aimed", unit: "%", better: "higher" },
};

function parsePoints(v: unknown): SeriesPoint[] {
  return arr(v)
    .map((p, i): SeriesPoint | null => {
      const o = obj(p);
      const value = o ? num(o, ["value", "v", "y"]) : finite(p);
      if (value === null) return null;
      const label =
        (o && text(first(o, ["label", "date", "week", "x"]))) ?? String(i + 1);
      return { label, value };
    })
    .filter((x): x is SeriesPoint => !!x)
    .slice(-40);
}
function parseSeries(raw: unknown): Series[] {
  const o = obj(raw);
  const entries: [string, unknown][] = o
    ? Object.entries(o).filter(([k]) => k !== "summary")
    : arr(raw).map((s) => [String(obj(s)?.key ?? ""), s]);
  return entries
    .map(([key, v]): Series | null => {
      const s = obj(v);
      const points = parsePoints(Array.isArray(v) ? v : s?.points);
      if (points.length < 2) return null;
      const known = KNOWN[key];
      return {
        key: key || String(text(s?.label) ?? "series"),
        label: text(s?.label) ?? known?.label ?? key,
        unit: text(s?.unit) ?? known?.unit ?? "",
        better: s?.better === "lower" ? "lower" : (known?.better ?? "higher"),
        points,
      };
    })
    .filter((x): x is Series => !!x)
    .slice(0, 6);
}
function parseEvolution(raw: unknown): Evolution | null {
  const o = obj(raw);
  if (!o) return null;
  const series = parseSeries(
    obj(o.series) || Array.isArray(o.series) ? o.series : o,
  );
  const summary = text(o.summary);
  if (!series.length && !summary) return null;
  return { ...(summary ? { summary } : {}), series };
}
function parseMatch(raw: unknown): MatchCard | null {
  const o = obj(raw);
  if (!o) return null;
  const card: MatchCard = {
    analysisId: text(o.analysisId),
    matchId: text(o.matchId),
    map: text(o.map),
    date: text(first(o, ["date", "createdAt"])),
    kills: num(o, ["kills"]),
    deaths: num(o, ["deaths"]),
    adr: num(o, ["adr"]),
    score: num(o, ["score", "rating", "overall"]),
  };
  const headline = text(first(o, ["headline", "why", "summary"]));
  if (headline) card.headline = headline;
  return card.analysisId || card.map || headline ? card : null;
}
function parseSummary(raw: unknown): ReportSummary {
  const o = obj(raw) ?? {};
  const s: ReportSummary = {
    matches: num(o, ["matches"]),
    rounds: num(o, ["rounds"]),
    winRate: pct(first(o, ["winRate", "wins"])),
    adr: num(o, ["adr", "avgAdr"]),
    kd: num(o, ["kd"]),
    rating: num(o, ["rating", "score", "overall"]),
  };
  const headline = text(first(o, ["headline", "title"]));
  if (headline) s.headline = headline;
  return s;
}

export function normalizeReport(raw: unknown): Report | null {
  const top = obj(raw);
  const o = obj(top?.report) ?? top;
  const id = o && text(o.id);
  if (!o || !id) return null;
  const narrative = text(o.narrative);
  return {
    id,
    period: periodOf(o.period),
    createdAt: text(o.createdAt),
    summary: parseSummary(o.summary),
    trends: parseSeries(o.trends),
    perMap: arr(o.perMap)
      .map((m): MapRow | null => {
        const x = obj(m);
        const map = x && text(x.map);
        return x && map
          ? {
              map,
              matches: num(x, ["matches"]),
              winRate: pct(first(x, ["winRate", "wins"])),
              adr: num(x, ["adr"]),
              kd: num(x, ["kd"]),
            }
          : null;
      })
      .filter((x): x is MapRow => !!x),
    recurring: arr(o.recurring)
      .map((r): Recurring | null => {
        const x = obj(r);
        const title = x && text(first(x, ["title", "pattern", "mistake"]));
        if (!x || !title) return null;
        const tr = x.trend;
        const tip = text(first(x, ["tip", "fix", "advice"]));
        return {
          title,
          count: num(x, ["count", "matches"]),
          trend: tr === "better" || tr === "worse" || tr === "same" ? tr : null,
          ...(tip ? { tip } : {}),
        };
      })
      .filter((x): x is Recurring => !!x)
      .slice(0, 8),
    utility: parseEvolution(o.utility),
    crosshair: parseEvolution(o.crosshair),
    bestMatch: parseMatch(o.bestMatch),
    worstMatch: parseMatch(o.worstMatch),
    plan: arr(o.plan)
      .map((p) => text(p) ?? text(obj(p)?.text))
      .filter((x): x is string => !!x)
      .slice(0, 8),
    narrative: narrative
      ? narrative
          .split(/\n{2,}/)
          .map((p) => p.trim())
          .filter(Boolean)
      : [],
  };
}

export function normalizeReportList(raw: unknown): ReportListItem[] {
  return arr(obj(raw)?.reports)
    .flatMap((r): ReportListItem[] => {
      const o = obj(r);
      const id = o && text(o.id);
      if (!o || !id) return [];
      return [
        {
          id,
          period: periodOf(o.period),
          createdAt: text(o.createdAt),
          summary: parseSummary(o.summary),
        },
      ];
    })
    .sort((a, b) => b.period.localeCompare(a.period));
}

/** Change from the first to the last point, signed so that positive = improvement. */
export function seriesDelta(s: Series) {
  const a = s.points[0]!.value;
  const b = s.points.at(-1)!.value;
  const d = b - a;
  return { delta: d, good: s.better === "lower" ? d < 0 : d > 0, last: b };
}
