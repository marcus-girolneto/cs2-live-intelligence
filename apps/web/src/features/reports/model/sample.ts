/** Generic sample report shown blurred behind the Pro lock (never real player data). */
import { normalizeReport, type Report } from "./report";

const weeks = (vals: number[]) =>
  vals.map((value, i) => ({ label: `W${i + 1}`, value }));
export const SAMPLE_REPORT: Report = normalizeReport({
  id: "sample",
  period: "2026-09",
  summary: {
    matches: 18,
    winRate: 56,
    adr: 84.3,
    kd: 1.12,
    rating: 1.08,
    headline: "Sharper aim, steadier economy.",
  },
  trends: {
    adr: weeks([76, 81, 79, 88]),
    kast: weeks([66, 70, 71, 74]),
    headshotPercentage: weeks([38, 41, 43, 45]),
  },
  perMap: [
    { map: "de_mirage", matches: 7, winRate: 71, adr: 91.2, kd: 1.3 },
    { map: "de_inferno", matches: 6, winRate: 50, adr: 80.4, kd: 1.05 },
    { map: "de_nuke", matches: 5, winRate: 40, adr: 77.9, kd: 0.92 },
  ],
  recurring: [
    { title: "Dies first without a trade", count: 9, trend: "better" },
    { title: "Flashes that blind teammates", count: 5, trend: "worse" },
  ],
  utility: { series: { efficiency: weeks([44, 49, 52, 58]) } },
  crosshair: { series: { medianOffset: weeks([6.1, 5.4, 4.9, 4.2]) } },
  bestMatch: { map: "de_mirage", kills: 27, deaths: 14, adr: 112.4, score: 86 },
  worstMatch: { map: "de_nuke", kills: 11, deaths: 19, adr: 58.3, score: 41 },
  plan: [
    "Trade within 2 seconds on every entry.",
    "Learn two Nuke outside smokes.",
  ],
})!;
