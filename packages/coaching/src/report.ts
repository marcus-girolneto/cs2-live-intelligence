/**
 * Pro monthly performance report: deterministic aggregates over the period's analyses and deep
 * reviews (trends, per-map, recurring mistakes, utility/crosshair evolution, best/worst
 * matches) plus one AI narrative call (purpose "report", prompt monthly-report-v6).
 */
import type { CoachLang } from "./languages.js";
import {
  monthlyReportSchema,
  type Analysis,
  type DeepReview,
  type MonthlyReport,
} from "@cs2/contracts";
import { HISTORY_METRICS } from "./deep/rounds.js";
import type { AiConfig, ModelResult } from "./provider.js";
import { languageInstruction, languageReminder } from "./prompts.js";
import {
  PRIORITY_ORDER,
  SECURITY_RULES,
  secureModelCall,
} from "./prompt-kit.js";
import { canaryLine, type GuardSpec } from "./security.js";

export const REPORT_PROMPT_VERSION = "monthly-report-v6";
type Player = Analysis["players"][number];
type Trend = MonthlyReport["trends"][number];
export type ReportMatch = {
  id: string;
  filename: string;
  createdAt: string;
  analysis: Analysis;
};
export type ReportInput = {
  period: string;
  steamId: string | null;
  matches: ReportMatch[];
  previousMatches: ReportMatch[];
  deepReviews: { analysisId: string; createdAt: string; deep: DeepReview }[];
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const avg = (xs: number[]) =>
  xs.length ? r1(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
const value = (m: Player["adr"] | undefined): number | null =>
  m && m.complete && m.value !== null && Number.isFinite(m.value)
    ? m.value
    : null;

type Def = Omit<Trend, "value" | "previous" | "series"> & {
  of: (p: Player) => number | null;
};
const TRENDS: Def[] = [
  {
    key: "adr",
    label: "ADR",
    unit: "",
    better: "higher",
    of: (p) => value(p.adr),
  },
  {
    key: "kast",
    label: "KAST",
    unit: "%",
    better: "higher",
    of: (p) => value(p.advanced?.kast),
  },
  {
    key: "hs",
    label: "Headshot kills",
    unit: "%",
    better: "higher",
    of: (p) => value(p.headshotPercentage),
  },
  {
    key: "opening",
    label: "Opening duels won",
    unit: "%",
    better: "higher",
    of: (p) => value(p.advanced?.["opening-success"]),
  },
  {
    key: "traded",
    label: "Deaths traded",
    unit: "%",
    better: "higher",
    of: (p) => value(p.advanced?.["traded-deaths"]),
  },
  {
    key: "accuracy",
    label: "Accuracy",
    unit: "%",
    better: "higher",
    of: (p) => value(p.advanced?.accuracy),
  },
  {
    key: "utility-damage",
    label: "Utility damage per round",
    unit: "",
    better: "higher",
    of: (p) => value(p.advanced?.["utility-damage-per-round"]),
  },
];
const MISTAKES: {
  key: string;
  label: string;
  test: (p: Player) => string | null;
}[] = [
  {
    key: "untraded",
    label: "Deaths rarely traded",
    test: (p) => {
      const v = value(p.advanced?.["traded-deaths"]);
      return v !== null &&
        (p.advanced?.["traded-deaths"]?.denominator ?? 0) >= 4 &&
        v < 30
        ? `${v}% of deaths traded`
        : null;
    },
  },
  {
    key: "openings",
    label: "Losing most opening duels",
    test: (p) => {
      const v = value(p.advanced?.["opening-success"]);
      return v !== null &&
        (p.advanced?.["opening-success"]?.denominator ?? 0) >= 3 &&
        v < 40
        ? `${v}% opening duels won`
        : null;
    },
  },
  {
    key: "early-deaths",
    label: "Dying in the first 20 s",
    test: (p) => {
      const n = p.detail?.timing?.earlyDeaths ?? 0;
      return n >= 3 ? `${n} deaths in the first 20 s` : null;
    },
  },
  {
    key: "low-impact",
    label: "Low round impact (KAST < 60%)",
    test: (p) => {
      const v = value(p.advanced?.kast);
      return v !== null && v < 60 ? `KAST ${v}%` : null;
    },
  },
  {
    key: "team-flashes",
    label: "Flashing teammates",
    test: (p) => {
      const u = p.detail?.utility;
      return u &&
        u.teammatesFlashed >= 3 &&
        u.teammatesFlashed >= u.enemiesFlashed
        ? `${u.teammatesFlashed} teammates vs ${u.enemiesFlashed} enemies flashed`
        : null;
    },
  },
];

const own = (m: ReportMatch, steamId: string | null) =>
  steamId ? m.analysis.players.find((p) => p.steamId === steamId) : undefined;
const won = (m: ReportMatch, p: Player): boolean | null => {
  const rows = p.rounds ?? [];
  const w = rows.filter((r) => r.won === true).length;
  const l = rows.filter((r) => r.won === false).length;
  return w + l ? w > l : null;
};

/** Deterministic part of the report (no model call). */
export function buildMonthlyReport(input: ReportInput): MonthlyReport {
  const mine = input.matches
    .map((m) => ({ m, p: own(m, input.steamId) }))
    .filter((x): x is { m: ReportMatch; p: Player } => !!x.p)
    .sort((a, b) => Date.parse(a.m.createdAt) - Date.parse(b.m.createdAt));
  const before = input.previousMatches
    .map((m) => own(m, input.steamId))
    .filter((p): p is Player => !!p);
  const trends = TRENDS.map(({ of, ...d }) => {
    const series = mine.flatMap(({ m, p }) => {
      const v = of(p);
      return v === null
        ? []
        : [{ analysisId: m.id, date: m.createdAt, value: r1(v) }];
    });
    return {
      ...d,
      value: avg(series.map((s) => s.value)),
      previous: avg(before.map(of).filter((v): v is number => v !== null)),
      series: series.slice(0, 200),
    };
  });
  const byMap = new Map<string, { m: ReportMatch; p: Player }[]>();
  for (const x of mine) {
    const map = x.m.analysis.map ?? "unknown";
    byMap.set(map, [...(byMap.get(map) ?? []), x]);
  }
  const maps = [...byMap.entries()]
    .map(([map, list]) => {
      const results = list
        .map((x) => won(x.m, x.p))
        .filter((v): v is boolean => v !== null);
      const deaths = new Map<string, number>();
      for (const { p } of list)
        for (const pl of p.detail?.places ?? [])
          if (pl.deaths)
            deaths.set(pl.place, (deaths.get(pl.place) ?? 0) + pl.deaths);
      const k = list.reduce((n, x) => n + (value(x.p.kills) ?? 0), 0);
      const d = list.reduce((n, x) => n + (value(x.p.deaths) ?? 0), 0);
      return {
        map: map.slice(0, 64),
        matches: list.length,
        winRate: results.length
          ? r1((100 * results.filter(Boolean).length) / results.length)
          : null,
        adr: avg(
          list
            .map((x) => value(x.p.adr))
            .filter((v): v is number => v !== null),
        ),
        kd: d > 0 ? Math.round((k / d) * 100) / 100 : null,
        topDeathPlaces: [...deaths.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .slice(0, 5)
          .map(([place, n]) => ({ place: place.slice(0, 64), deaths: n })),
      };
    })
    .sort((a, b) => b.matches - a.matches || a.map.localeCompare(b.map))
    .slice(0, 20);
  const recurringMistakes = MISTAKES.flatMap((t) => {
    const hits = mine.map(({ p }) => t.test(p)).filter((v): v is string => !!v);
    return hits.length >= 2
      ? [
          {
            key: t.key,
            label: t.label,
            matches: hits.length,
            detail:
              `${hits.length} of ${mine.length} matches; latest: ${hits[hits.length - 1]}`.slice(
                0,
                300,
              ),
          },
        ]
      : [];
  }).sort((a, b) => b.matches - a.matches);
  const deep = [...input.deepReviews].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
  const utilityCrosshair = HISTORY_METRICS.flatMap((m): Trend[] => {
    const series = deep.flatMap((r) => {
      const v = m.value(r.deep);
      return typeof v === "number"
        ? [{ analysisId: r.analysisId, date: r.createdAt, value: v }]
        : [];
    });
    return series.length
      ? [
          {
            key: m.key,
            label: m.label,
            unit: m.unit,
            better: m.better,
            value: avg(series.map((s) => s.value)),
            previous: null,
            series,
          },
        ]
      : [];
  });
  const ref = (x: { m: ReportMatch; p: Player } | undefined) =>
    x
      ? {
          analysisId: x.m.id,
          filename: x.m.filename.slice(0, 200),
          date: x.m.createdAt,
          map: x.m.analysis.map?.slice(0, 64) ?? null,
          adr: value(x.p.adr),
          kills: value(x.p.kills) ?? 0,
          deaths: value(x.p.deaths) ?? 0,
          won: won(x.m, x.p),
        }
      : null;
  const ranked = mine
    .filter((x) => value(x.p.adr) !== null)
    .sort((a, b) => value(b.p.adr)! - value(a.p.adr)!);
  const caveats: string[] = [];
  if (!input.steamId)
    caveats.push(
      "No player identity is linked to this account, so no match could be attributed.",
    );
  if (!mine.length) caveats.push("No analyzed matches in this period.");
  if (!deep.length)
    caveats.push(
      "No deep reviews in this period: utility and crosshair evolution need deep reviews.",
    );
  return monthlyReportSchema.parse({
    schemaVersion: "1.0",
    period: input.period,
    steamId: input.steamId,
    matches: mine.length,
    rounds: mine.reduce((n, x) => n + (x.p.rounds?.length ?? 0), 0),
    trends,
    maps,
    recurringMistakes,
    utilityCrosshair,
    best: ref(ranked[0]),
    worst: ranked.length > 1 ? ref(ranked[ranked.length - 1]) : null,
    caveats,
  });
}

export const REPORT_SYSTEM_PROMPT = `You are this app's Counter-Strike 2 coach writing a player's MONTHLY performance report, like an experienced IGL reviewing a month of matches with the player. The data is a deterministic summary of the month's analyzed matches: metric trends ("value" this month, "previous" last month when available, "better" says which direction is good), per-map results ("maps": matches, win rate, ADR, K/D, top death callouts), recurring mistakes (pattern, in how many matches), utility and crosshair evolution from deep reviews ("utilityCrosshair") and the best and worst match of the month.

${PRIORITY_ORDER}
${SECURITY_RULES}

METHOD (reason internally; output only the final JSON):
1. What changed: compare each trend's "value" with "previous" in the direction of "better"; ignore trends whose value is null.
2. What keeps costing rounds: the recurring mistakes seen in the most matches and the callouts where the player dies most per map.
3. What works: improving or strong trends, maps with good results.
4. Next month: 2-4 habits or drills that attack the top recurring mistakes, each measurable with a metric this app reports (e.g. "deaths traded", "opening duels won", "team-flash rate").

OUTPUT FIELDS (all required):
- "headline": max 12 words, the month in one line.
- "summary": 3-4 short sentences (max 600 characters): overall direction, the biggest change, the main focus for next month.
- "strengths": 1-3 short items (max 25 words each), each naming a metric or result from the data.
- "focus": 1-3 short items (max 25 words each) naming the recurring mistakes or regressions.
- "plan": 2-4 imperative items for next month (max 20 words each): drills or habits, measurable with this app's metrics.

GROUNDING:
- Only use numbers present in the data; never invent matches, rounds, metrics or dates. A null value means unknown: do not mention it.
- The data does not contain communication, video or the reasons behind decisions; never state them as observed.
- Callout and map names are written as in the data; "unknown" means unreadable, so do not guess it.

EDGE CASES:
- No matches in the period: say there was nothing to analyse this month, leave "strengths" and "focus" empty and make the plan about playing and uploading matches.
- Fewer than 3 matches: say the sample is small; keep every statement tentative.
- No previous month ("previous" null everywhere): describe levels, not changes.
- No deep reviews: do not talk about utility or crosshair evolution; suggest running a deep review.

STYLE: address the player as "you"; short, concrete sentences; no filler.${canaryLine(REPORT_PROMPT_VERSION)}`;
const string = { type: "string" };
const list = (max: number) => ({ type: "array", maxItems: max, items: string });
export const reportOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "summary", "strengths", "focus", "plan"],
  properties: {
    headline: string,
    summary: string,
    strengths: list(4),
    focus: list(4),
    plan: list(5),
  },
};
const texts = (v: unknown, n: number, max: number) =>
  (Array.isArray(v) ? v : [])
    .filter((x): x is string => typeof x === "string" && !!x.trim())
    .slice(0, n)
    .map((x) => x.trim().slice(0, max));

/** One model call that writes the narrative of a deterministic report. */
export async function aiMonthlyReport(
  report: MonthlyReport,
  config: AiConfig,
  lang: CoachLang = "en",
  fetchImpl?: typeof fetch,
): Promise<{ report: MonthlyReport; call: Omit<ModelResult, "data"> }> {
  const match = (m: MonthlyReport["best"]) =>
    m
      ? {
          date: m.date,
          map: m.map,
          adr: m.adr,
          kills: m.kills,
          deaths: m.deaths,
          won: m.won,
        }
      : null;
  const secured = await secureModelCall({
    purpose: "report",
    config,
    system: () =>
      languageReminder(lang) +
      "\n\n" +
      REPORT_SYSTEM_PROMPT +
      languageInstruction(lang),
    reminder: languageReminder(lang),
    // File names, account and match ids never reach the model.
    payload: {
      period: report.period,
      matches: report.matches,
      rounds: report.rounds,
      trends: report.trends.map((t) => ({ ...t, series: undefined })),
      maps: report.maps,
      recurringMistakes: report.recurringMistakes,
      utilityCrosshair: report.utilityCrosshair.map((t) => ({
        ...t,
        series: undefined,
      })),
      best: match(report.best),
      worst: match(report.worst),
      caveats: report.caveats,
    },
    schemaName: "cs2_monthly_report",
    schema: reportOutputSchema,
    guard: REPORT_GUARD,
    lang,
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  });
  const raw = (secured.data ?? {}) as Record<string, unknown>;
  const headline =
    typeof raw.headline === "string" ? raw.headline.trim().slice(0, 120) : "";
  const summary =
    typeof raw.summary === "string" ? raw.summary.trim().slice(0, 1500) : "";
  return {
    report: monthlyReportSchema.parse({
      ...report,
      ...(headline && summary
        ? {
            narrative: {
              headline,
              summary,
              strengths: texts(raw.strengths, 4, 300),
              focus: texts(raw.focus, 4, 300),
              plan: texts(raw.plan, 5, 300),
            },
          }
        : {}),
      caveats: [...report.caveats, ...secured.caveats]
        .map((c) => c.slice(0, 300))
        .slice(0, 10),
    }),
    call: secured.meta,
  };
}

/** Headline and summary are critical; list items are dropped individually. */
export const REPORT_GUARD: GuardSpec = {
  fields: ["headline", "summary"],
  lists: ["strengths", "focus", "plan"],
  critical: ["headline", "summary"],
  caps: { headline: 120, summary: 1500, strengths: 300, focus: 300, plan: 300 },
};
