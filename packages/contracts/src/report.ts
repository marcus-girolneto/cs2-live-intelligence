import { z } from "zod";

/** Pro monthly performance report (GET /v1/reports/:id `report`). */
const num = z.number().finite();
const count = z.number().int().nonnegative();
const metricTrend = z.object({
  key: z.string().max(40),
  label: z.string().max(80),
  unit: z.string().max(8),
  better: z.enum(["lower", "higher"]),
  /** Mean over the period's matches (null when no match had it). */
  value: num.nullable(),
  /** Mean of the previous period, when there were matches. */
  previous: num.nullable(),
  /** Per-match values in chronological order. */
  series: z
    .array(z.object({ analysisId: z.string(), date: z.string(), value: num }))
    .max(200),
});
const matchRef = z.object({
  analysisId: z.string(),
  filename: z.string().max(200),
  date: z.string(),
  map: z.string().max(64).nullable(),
  adr: num.nullable(),
  kills: count,
  deaths: count,
  won: z.boolean().nullable(),
});
export const monthlyReportSchema = z.object({
  schemaVersion: z.literal("1.0"),
  /** YYYY-MM (app time zone). */
  period: z.string().regex(/^\d{4}-\d{2}$/),
  steamId: z.string().max(64).nullable(),
  matches: count,
  rounds: count,
  trends: z.array(metricTrend).max(12),
  maps: z
    .array(
      z.object({
        map: z.string().max(64),
        matches: count,
        winRate: num.nullable(),
        adr: num.nullable(),
        kd: num.nullable(),
        topDeathPlaces: z
          .array(z.object({ place: z.string().max(64), deaths: count }))
          .max(5),
      }),
    )
    .max(20),
  recurringMistakes: z
    .array(
      z.object({
        key: z.string().max(40),
        label: z.string().max(120),
        matches: count,
        detail: z.string().max(300),
      }),
    )
    .max(8),
  /** From deep reviews in the period (empty when none). */
  utilityCrosshair: z.array(metricTrend).max(8),
  best: matchRef.nullable(),
  worst: matchRef.nullable(),
  /** AI narrative (purpose "report"); absent when the model was unavailable. */
  narrative: z
    .object({
      headline: z.string().max(120),
      summary: z.string().max(1500),
      strengths: z.array(z.string().max(300)).max(4),
      focus: z.array(z.string().max(300)).max(4),
      plan: z.array(z.string().max(300)).max(5),
    })
    .optional(),
  caveats: z.array(z.string().max(300)).max(10),
});
export type MonthlyReport = z.infer<typeof monthlyReportSchema>;
