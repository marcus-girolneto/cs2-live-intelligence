import { z } from "zod";

export const planItemSchema = z.object({
  text: z.string().max(300),
  scope: z.enum(["map", "general"]),
  map: z.string().max(64).optional(),
});
export type PlanItemDto = z.infer<typeof planItemSchema>;

const learnedMetric = z.object({
  overall: z.number().nullable(),
  recent: z.number().nullable(),
  matches: z.number().int(),
});
/** One map tab of GET /v1/coach/progress. */
export const mapProgressSchema = z.object({
  map: z.string(),
  matches: z.number().int(),
  rounds: z.number().int(),
  lastPlayedAt: z.string(),
  metrics: z.record(learnedMetric),
  recurring: z.array(z.object({ pattern: z.string(), matches: z.number() })),
  places: z.array(
    z.object({
      place: z.string(),
      kills: z.number(),
      deaths: z.number(),
      matches: z.number(),
    }),
  ),
  /** Map-scoped items of the latest review on this map (empty when none). */
  openPlanItems: z.array(planItemSchema),
  openPlanFrom: z.object({ reviewId: z.string(), date: z.string() }).nullable(),
});
export type MapProgressDto = z.infer<typeof mapProgressSchema>;
export const progressByMapSchema = z.object({
  maps: z.array(mapProgressSchema),
  /** General items of the latest review that has any. */
  generalPlan: z.array(planItemSchema),
  generalPlanFrom: z
    .object({ reviewId: z.string(), date: z.string() })
    .nullable(),
});
export type ProgressByMapDto = z.infer<typeof progressByMapSchema>;
