import { z } from "zod";
import type { CoachPreferences } from "@cs2/coaching";

/** In-demo player identity: SteamID64 for real players; demos may also carry other ids. */
export const playerIdSchema = z.string().regex(/^[0-9A-Za-z_-]{1,64}$/);
export const langSchema = z
  .unknown()
  .transform((v): "en" | "pt" => (v === "pt" ? "pt" : "en"));

/** PUT /v1/coach/profile: `playerSteamId` null clears it; undefined keeps it. */
export const coachPlayerIdSchema = playerIdSchema.nullable().optional();
export type CoachProfileRequestDto = {
  preferences?: unknown;
  playerSteamId?: unknown;
};
/** POST /v1/coach/reviews/:id/rating. */
export const ratingRequestSchema = z.object({
  rating: z.number().int().min(1).max(5),
});
/** POST /v1/analyses/:id/coaching: tier defaults to quick. */
export const reviewRequestSchema = z.object({
  steamId: playerIdSchema,
  lang: langSchema,
  tier: z.enum(["quick", "deep"]).default("quick"),
});
/** POST /v1/analyses/:id/team-review: steamId = the requester's player (a team member). */
export const teamReviewRequestSchema = z.object({
  steamId: playerIdSchema,
  lang: langSchema,
});
/** GET /v1/coach/progress?map= (map names are demo strings: allowlisted characters). */
export const progressQuerySchema = z.object({
  map: z
    .string()
    .regex(/^[A-Za-z0-9_ .'-]{1,64}$/)
    .optional(),
});
/** PUT /v1/coach/identity. */
export const identityRequestSchema = z
  .object({
    steamId: playerIdSchema,
    analysisIds: z
      .union([z.literal("all"), z.array(z.string().min(1).max(128)).max(500)])
      .default("all"),
  })
  .strict();
/** PATCH /v1/matches/:id/ownership. */
export const ownershipRequestSchema = z
  .object({
    ownership: z.enum(["mine", "external"]),
    playerSteamId: playerIdSchema.optional(),
  })
  .strict();
/** ?ids=a,b,c (at most 100 job ids). */
export const idsQuerySchema = z.object({
  ids: z
    .string()
    .max(100 * 130)
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().min(1).max(128)).max(100)),
});
/** GET /v1/analyses/:id/reviews and /reel query. */
export const playerQuerySchema = z.object({ steamId: playerIdSchema });
/** POST /v1/ai/live-call: a live session id, or a replayed frame's state. */
export type LiveCallRequestDto = {
  sessionId?: unknown;
  state?: unknown;
  recentRounds?: unknown;
  baseline?: unknown;
  lang?: unknown;
  analysisId?: unknown;
};

export type CoachProfileRecord = {
  preferences: unknown;
  playerSteamId: string | null;
  linkedToSteam: boolean;
};
export type CoachProfileDto = {
  preferences: CoachPreferences;
  playerSteamId: string | null;
  linkedToSteam: boolean;
};
export type NewReview = {
  ownerId: string;
  analysisId: string;
  steamId: string;
  tier: "quick" | "deep";
  /** Prompt A/B variant (default "a"). */
  variant?: "a" | "b";
  creditsSpent: number;
  provider: string;
  model: string;
  promptVersion: string;
  lang: string;
  preferences: unknown;
  coaching: unknown;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
};
export type ReviewRecord = {
  id: string;
  analysisId: string;
  filename: string;
  steamId: string;
  provider: string;
  model: string;
  promptVersion: string;
  coaching: { summary?: string; plan?: string[] };
  rating: number | null;
  latencyMs: number;
  createdAt: string;
  tier: "quick" | "deep";
};
/** One saved review of a match/player (GET /v1/analyses/:id/reviews item). */
export type MatchReviewRecord = {
  id: string;
  tier: "quick" | "deep";
  provider: string;
  model: string;
  promptVersion: string;
  lang: string;
  coaching: unknown;
  rating: number | null;
  creditsSpent: number;
  createdAt: string;
};
export type NewLiveCall = {
  ownerId: string;
  sessionId: string | null;
  round: number | null;
  call: unknown;
  provider: string;
  model: string;
  promptVersion: string;
  latencyMs: number;
};
export type LiveCallRecord = {
  id: string;
  sessionId: string | null;
  round: number | null;
  call: unknown;
  model: string;
  createdAt: string;
};
