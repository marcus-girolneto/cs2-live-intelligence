import { z } from "zod";
import { feedbackSchema } from "@cs2/contracts";

/** POST /v1/feedback. */
export const feedbackRequestSchema = feedbackSchema;
export type FeedbackRequestDto = z.infer<typeof feedbackSchema>;

export type EventProperties = Record<string, string | number | boolean | null>;
/** POST /v1/events: snake_case name, ≤10 primitive properties, ≤2 KiB serialized. */
export const eventNameSchema = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
export const eventPropertiesSchema = z
  .record(
    z.string().regex(/^[a-z][a-z0-9_]{0,31}$/),
    z.union([z.string(), z.number(), z.boolean(), z.null()]),
  )
  .refine((p) => Object.keys(p).length <= 10)
  .refine((p) => JSON.stringify(p).length <= 2048);
