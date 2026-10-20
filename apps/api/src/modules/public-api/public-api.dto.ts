import { z } from "zod";
import { langSchema, playerIdSchema } from "../coaching/coaching.dto.js";

const map = z
  .string()
  .regex(/^[A-Za-z0-9_ .'-]{1,64}$/)
  .describe("Map name as recorded in the demo, e.g. de_mirage");

/** GET /api/v1/demos */
export const demosQuerySchema = z.object({
  cursor: z
    .string()
    .max(200)
    .optional()
    .describe("Opaque cursor from the previous page's nextCursor"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  ownership: z.enum(["mine", "external"]).optional(),
  map: map.optional(),
});
export type DemosQuery = z.infer<typeof demosQuerySchema>;

/** GET /api/v1/demos/:id/analysis */
export const analysisQuerySchema = z.object({
  include: z
    .enum(["events"])
    .optional()
    .describe("events: also return every parsed event (large)"),
});

/** POST /api/v1/demos/:id/reviews */
export const reviewRequestSchema = z
  .object({
    steamId: playerIdSchema.describe("The player to review (SteamID64)"),
    tier: z.enum(["quick", "deep", "team"]).default("quick"),
    lang: langSchema.describe("Language of the review"),
  })
  .strict();
export type PublicReviewRequest = z.infer<typeof reviewRequestSchema>;

/** GET /api/v1/demos/:id/reviews */
export const reviewsQuerySchema = z.object({
  steamId: playerIdSchema.optional(),
});
export const progressQuerySchema = z.object({ map: map.optional() });
export const ledgerQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/** Idempotency-Key header: replays the first response for 24 hours. */
export const idempotencyKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9_.:-]{1,128}$/);

// Response shapes (documented in openapi.json).
const iso = z.string().datetime();
export const demoSchema = z.object({
  id: z.string().uuid(),
  filename: z.string(),
  status: z.enum(["queued", "processing", "complete", "failed"]),
  error: z.string().nullable(),
  createdAt: iso,
  completedAt: iso.nullable(),
  ownership: z
    .enum(["mine", "external"])
    .nullable()
    .describe("Whether you played in this match (null until classified)"),
  playerSteamId: z.string().nullable(),
  match: z
    .object({
      map: z.string().nullable(),
      rounds: z.number().int(),
      score: z.object({
        ct: z.number().int().nullable(),
        t: z.number().int().nullable(),
      }),
      tickRate: z.number().int().nullable(),
      parserVersion: z.string().nullable(),
      players: z.number().int(),
    })
    .nullable(),
  links: z.record(z.string()),
});
export const demoPageSchema = z.object({
  data: z.array(demoSchema),
  nextCursor: z.string().nullable(),
});
export const uploadAcceptedSchema = z.object({
  id: z.string().uuid(),
  status: z.literal("queued"),
  links: z.record(z.string()),
});
export const analysisResponseSchema = z.object({
  demoId: z.string().uuid(),
  map: z.string().nullable(),
  provenance: z.record(z.unknown()).nullable(),
  rounds: z.array(
    z.object({
      round: z.number().int(),
      winner: z.enum(["CT", "T"]).optional(),
    }),
  ),
  players: z
    .array(z.record(z.unknown()))
    .describe(
      "Per-player metrics (kills, deaths, ADR, KAST, HS%, aim, utility...)",
    ),
  evidence: z.array(z.record(z.unknown())),
  caveats: z.array(z.string()),
  integrity: z.record(z.unknown()).nullable(),
  coaching: z.unknown().describe("Offline (non-AI) coaching of the match"),
  events: z.array(z.record(z.unknown())).optional(),
});
export const playerResponseSchema = z.object({
  demoId: z.string().uuid(),
  steamId: z.string(),
  player: z.record(z.unknown()),
  lobby: z
    .record(z.unknown())
    .describe("How the player ranks against the lobby"),
});
export const reviewSchema = z.object({
  id: z.string().uuid(),
  demoId: z.string().uuid(),
  steamId: z.string(),
  tier: z.enum(["quick", "deep", "team"]),
  lang: z.string(),
  createdAt: iso,
  creditsSpent: z.number().int(),
  rating: z.number().int().nullable(),
  review: z.unknown().describe("The AI review document"),
  links: z.record(z.string()),
});
export const createdReviewSchema = reviewSchema.extend({
  balance: z.number().int().describe("Credit balance after this review"),
});
export const reviewListSchema = z.object({ data: z.array(reviewSchema) });
export const meSchema = z.object({
  id: z.string(),
  steamId: z.string().nullable(),
  displayName: z.string().nullable(),
  memberSince: z.string().nullable(),
  plan: z.object({ id: z.string(), name: z.string(), status: z.string() }),
  credits: z.object({
    balance: z.number().int(),
    buckets: z.record(z.number().int()),
    costs: z.record(z.number().int()),
  }),
  usage: z.record(z.unknown()),
  uploadMaxBytes: z.number().int().nullable(),
  apiKey: z.object({ id: z.string().uuid(), scopes: z.array(z.string()) }),
});
export const ledgerSchema = z.object({
  entries: z.array(
    z.object({
      id: z.string(),
      delta: z.number().int(),
      reason: z.string(),
      bucket: z.string(),
      ref: z.string().optional(),
      note: z.string().optional(),
      expiresAt: z.string().optional(),
      createdAt: iso,
    }),
  ),
});
export const errorSchema = z.object({
  error: z.object({
    code: z.string().describe("Stable machine-readable code"),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    requestId: z.string(),
  }),
});
