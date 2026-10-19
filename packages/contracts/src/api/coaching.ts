import { z } from "zod";

export type CoachPreferencesDto = Record<string, unknown>;
/** GET/PUT /v1/coach/profile. */
export type CoachProfileDto = {
  preferences: CoachPreferencesDto;
  playerSteamId: string | null;
  linkedToSteam: boolean;
};

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

export type ProgressPointDto = {
  analysisId: string;
  filename: string;
  date: string;
  map: string | null;
  rounds: number | null;
  adr: number | null;
  kills: number | null;
  deaths: number | null;
  headshotPercentage: number | null;
  kast: number | null;
  openingSuccess: number | null;
  tradedDeaths: number | null;
};
/** Stored review (provider/model only for admins). */
export type ReviewSummaryDto = {
  id: string;
  analysisId: string;
  filename: string;
  steamId: string;
  provider?: string;
  model?: string;
  promptVersion: string;
  coaching: { summary?: string; plan?: string[] } & Record<string, unknown>;
  rating: number | null;
  latencyMs: number;
  createdAt: string;
  tier?: "quick" | "deep";
};
export type LiveCallSummaryDto = {
  id: string;
  sessionId: string | null;
  round: number | null;
  call: unknown;
  model?: string;
  createdAt: string;
};
/** GET /v1/coach/progress. */
export type CoachProgressDto = ProgressByMapDto & {
  playerSteamId: string | null;
  linkedToSteam: boolean;
  analyzedMatches: number;
  profile: unknown;
  timeline: ProgressPointDto[];
  reviews: ReviewSummaryDto[];
  liveCalls: LiveCallSummaryDto[];
};
/** POST /v1/analyses/:id/coaching body (tier defaults to quick). */
export type PlayerReviewRequest = {
  steamId: string;
  lang?: "en" | "pt";
  tier?: "quick" | "deep";
};
/** POST /v1/analyses/:id/coaching. */
export type PlayerReviewDto = {
  reviewId: string;
  steamId: string;
  tier: "quick" | "deep";
  creditsSpent: number;
  /** Balance after the charge. */
  balance: number;
  call: { latencyMs: number; attempts: number } & Record<string, unknown>;
  coaching: unknown;
  personalization: {
    preferences: CoachPreferencesDto;
    learnedFromMatches: number;
    previousPlans: number;
  };
};
/** POST /v1/ai/live-call. */
export type LiveCallDto = {
  id: string;
  call: unknown;
  meta: { latencyMs: number; attempts: number } & Record<string, unknown>;
};

/** GET /v1/analyses/:id/reviews?steamId= (saved reviews per tier; re-opening is free). */
export type MatchReviewsDto = {
  analysisId: string;
  steamId: string;
  latest: { quick: string | null; deep: string | null };
  reviews: {
    reviewId: string;
    tier: "quick" | "deep";
    createdAt: string;
    creditsSpent: number;
    promptVersion: string;
    lang: string;
    rating: number | null;
    provider?: string;
    model?: string;
    coaching: unknown;
  }[];
};
/** GET /v1/analyses/:id/reel?steamId= (Pro): clip windows in match order. */
export type MatchReelDto = {
  analysisId: string;
  steamId: string;
  map: string | null;
  totalSeconds: number;
  clips: {
    round: number;
    from: number;
    to: number;
    focusSteamId: string;
    eventIds: string[];
    label?: string;
    kind: "highlight" | "mistake";
    title: string;
    score: number;
  }[];
};
