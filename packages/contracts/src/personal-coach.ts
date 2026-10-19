import { z } from "zod";

/**
 * Pro "Personal Coach": a long-term improvement plan built from ALL of a player's analyzed
 * matches, reviews, plans and deep modules. Every claim cites aggregate ids computed in code
 * (`facts`); the server drops anything citing an unknown id.
 */
const factId = z.string().min(1).max(80);
export const coachFactSchema = z.object({
  id: factId,
  label: z.string().max(160),
  value: z.number().finite(),
  unit: z.string().max(8),
  /** Recent minus earlier (or after minus before a plan), when known. */
  trend: z.number().finite().nullable(),
  better: z.enum(["higher", "lower"]).nullable(),
  matches: z.number().int().nonnegative(),
  map: z.string().max(64).optional(),
});
export type CoachFact = z.infer<typeof coachFactSchema>;
const cited = z.object({
  text: z.string().max(400),
  evidence: z.array(factId).min(1).max(6),
});
export const personalCoachPlanSchema = z.object({
  schemaVersion: z.literal("1.0"),
  promptVersion: z.string().max(40),
  headline: z.string().max(140),
  workingWell: z.array(cited).max(5),
  notWorking: z.array(cited).max(5),
  focusAreas: z
    .array(
      z.object({
        area: z.string().max(60),
        why: z.string().max(400),
        /** A fact id; `current` is copied from that fact by the server. */
        targetMetric: factId,
        current: z.number().finite().nullable(),
        target: z.number().finite().nullable(),
      }),
    )
    .max(4),
  weeklyProgram: z
    .array(
      z.object({
        week: z.number().int().min(1).max(12),
        goals: z.array(z.string().max(200)).max(4),
        drills: z
          .array(
            z.object({
              name: z.string().max(120),
              minutesPerDay: z.number().int().min(5).max(180),
              howTo: z.string().max(500),
            }),
          )
          .max(5),
      }),
    )
    .max(8),
  perMap: z
    .array(z.object({ map: z.string().max(64), notes: z.string().max(500) }))
    .max(10),
  nextReviewSuggestion: z.string().max(400),
  generatedAt: z.string(),
  basedOnMatches: z.number().int().nonnegative(),
  /** The aggregates the plan was allowed to cite (shown next to the plan). */
  facts: z.array(coachFactSchema).max(120),
  caveats: z.array(z.string().max(300)).max(8),
});
export type PersonalCoachPlan = z.infer<typeof personalCoachPlanSchema>;
