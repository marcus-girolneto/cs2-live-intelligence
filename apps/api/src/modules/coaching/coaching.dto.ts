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
/** POST /v1/analyses/:id/coaching. */
export const reviewRequestSchema = z.object({
  steamId: playerIdSchema,
  lang: langSchema,
});
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
