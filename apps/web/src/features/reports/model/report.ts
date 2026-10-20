/**
 * Monthly performance report (Pro): DTO → view model. Every field is optional and validated
 * so a partial report renders without gaps, NaN or "undefined".
 */
import { finite, text } from "@/shared/format";

import {
  arr,
  first,
  num,
  obj,
  parseEvolution,
  parseSeries,
  pct,
  type Evolution,
  type Series,
} from "./series";

export type { Evolution, Series, SeriesPoint } from "./series";
export { seriesDelta } from "./series";
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
  strengths: string[];
  focus: string[];
  caveats: string[];
};
export type ReportListItem = {
  id: string;
  period: string;
  createdAt: string | null;
  summary: ReportSummary;
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
  const won = o.won === true ? "Win" : o.won === false ? "Loss" : null;
  const headline =
    text(first(o, ["headline", "why", "summary"])) ??
    [won, text(o.filename)].filter(Boolean).join(" · ");
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

const strings = (v: unknown, max = 8) =>
  arr(v)
    .map((p) => text(p) ?? text(obj(p)?.text))
    .filter((x): x is string => !!x)
    .slice(0, max);
const CROSSHAIR_KEY = /aim|offset|crosshair/i;
/** KPI tiles: explicit summary first, else the period means of the trend metrics. */
function summaryOf(o: Record<string, unknown>, top: Record<string, unknown>) {
  const s = parseSummary(o.summary ?? o);
  const mean = (re: RegExp) => {
    for (const t of arr(o.trends)) {
      const x = obj(t);
      if (x && re.test(String(x.key ?? ""))) return finite(x.value);
    }
    return null;
  };
  s.matches ??= num(top, ["matches"]);
  s.adr ??= mean(/^adr$/i);
  s.kd ??= mean(/^kd$/i);
  s.winRate ??= pct(mean(/^win/i));
  const headline =
    s.headline ??
    text(obj(o.narrative)?.headline) ??
    text(first(top, ["headline"]));
  if (headline) s.headline = headline;
  return s;
}

export function normalizeReport(raw: unknown): Report | null {
  const top = obj(raw);
  // ReportDto: summary fields at the top, the MonthlyReport under `report`.
  const o = obj(top?.report) ?? top;
  const id = top && text(top.id);
  if (!o || !top || !id) return null;
  const story = obj(o.narrative);
  const narrative = text(o.narrative) ?? text(story?.summary);
  const evo = arr(o.utilityCrosshair);
  const split = (cross: boolean) =>
    evo.length
      ? parseEvolution({
          series: evo.filter(
            (t) => CROSSHAIR_KEY.test(String(obj(t)?.key ?? "")) === cross,
          ),
        })
      : parseEvolution(cross ? o.crosshair : o.utility);
  return {
    id,
    period: periodOf(o.period ?? top.period),
    createdAt: text(top.createdAt) ?? text(o.createdAt),
    summary: summaryOf(o, top),
    trends: parseSeries(o.trends),
    perMap: arr(o.maps ?? o.perMap)
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
    recurring: arr(o.recurringMistakes ?? o.recurring)
      .map((r): Recurring | null => {
        const x = obj(r);
        const title =
          x && text(first(x, ["label", "title", "pattern", "mistake"]));
        if (!x || !title) return null;
        const tr = x.trend;
        const tip = text(first(x, ["detail", "tip", "fix", "advice"]));
        return {
          title,
          count: num(x, ["count", "matches"]),
          trend: tr === "better" || tr === "worse" || tr === "same" ? tr : null,
          ...(tip ? { tip } : {}),
        };
      })
      .filter((x): x is Recurring => !!x)
      .slice(0, 8),
    utility: split(false),
    crosshair: split(true),
    bestMatch: parseMatch(o.best ?? o.bestMatch),
    worstMatch: parseMatch(o.worst ?? o.worstMatch),
    plan: strings(story?.plan ?? o.plan),
    strengths: strings(story?.strengths, 4),
    focus: strings(story?.focus, 4),
    caveats: strings(o.caveats, 10),
    narrative: narrative
      ? narrative
          .split(/\n{2,}/)
          .map((p) => p.trim())
          .filter(Boolean)
      : [],
  };
}

export function normalizeReportList(raw: unknown): ReportListItem[] {
  return arr(Array.isArray(raw) ? raw : obj(raw)?.reports)
    .flatMap((r): ReportListItem[] => {
      const o = obj(r);
      const id = o && text(o.id);
      if (!o || !id) return [];
      return [
        {
          id,
          period: periodOf(o.period),
          createdAt: text(o.createdAt),
          summary: parseSummary(o.summary ?? o),
        },
      ];
    })
    .sort((a, b) => b.period.localeCompare(a.period));
}
