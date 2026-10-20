import { z } from "zod";
const count = z.number().int().nonnegative();
// Deliberate allowlist: allplayers, positions, auth and arbitrary game fields never leave ingest.
export const gsiSchema = z.object({
  provider: z
    .object({
      timestamp: z.number().nonnegative().optional(),
      steamid: z.string().optional(),
    })
    .optional(),
  map: z
    .object({
      name: z.string().max(128).optional(),
      mode: z.string().max(64).optional(),
      phase: z.string().max(64).optional(),
      round: count.optional(),
      team_ct: z.object({ score: count.optional() }).optional(),
      team_t: z.object({ score: count.optional() }).optional(),
    })
    .optional(),
  round: z.object({ phase: z.string().max(64).optional() }).optional(),
  player: z
    .object({
      steamid: z.string().optional(),
      activity: z.string().optional(),
      state: z
        .object({
          health: count.max(100).optional(),
          armor: count.max(100).optional(),
        })
        .optional(),
      match_stats: z
        .object({
          kills: count.optional(),
          deaths: count.optional(),
          assists: count.optional(),
        })
        .optional(),
    })
    .optional(),
});
export const envelopeSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    eventId: z.string().min(1).max(128),
    deviceId: z.string().min(1).max(128),
    sessionId: z.string().min(1).max(128),
    sequence: count,
    observedAt: z.string().datetime(),
    receivedAt: z.string().datetime(),
    source: z.literal("gsi"),
    visibility: z.literal("own-player"),
    payload: gsiSchema,
  })
  .strict();
export type TelemetryEnvelope = z.infer<typeof envelopeSchema>;
export type GsiPayload = z.infer<typeof gsiSchema>;
export const liveStateSchema = z.object({
  schemaVersion: z.literal("1.0"),
  sessionId: z.string(),
  source: z.literal("gsi"),
  visibility: z.literal("own-player"),
  sequence: count,
  observedAt: z.string().datetime(),
  receivedAt: z.string().datetime(),
  map: z.string().optional(),
  phase: z.string().optional(),
  round: count.optional(),
  score: z.object({ ct: count.optional(), t: count.optional() }).optional(),
  ownStats: z
    .object({
      kills: count.optional(),
      deaths: count.optional(),
      assists: count.optional(),
      health: count.optional(),
      armor: count.optional(),
    })
    .optional(),
});
export type LiveState = z.infer<typeof liveStateSchema>;
export type ServerMessage =
  | { type: "snapshot"; state: LiveState | null }
  | {
      type: "diff";
      sessionId: string;
      sequence: number;
      changes: Partial<LiveState>;
    }
  | { type: "heartbeat"; at: string };
export const STALE_AFTER_MS = 5000;

export * from "./platform.js";
export * from "./deep.js";
export * from "./report.js";
export * from "./personal-coach.js";
export * from "./team.js";
export * from "./languages.js";
export * from "./callouts.js";
export * as api from "./api/index.js";
