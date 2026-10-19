import type { PersonalCoachPlan } from "../personal-coach.js";
import type { LobbyComparison, TeamReview } from "../team.js";
import { z } from "zod";

export type CoachPreferencesDto = Record<string, unknown>;
/** GET/PUT /v1/coach/profile. */
export type CoachProfileDto = {
  preferences: CoachPreferencesDto;
  playerSteamId: string | null;
  linkedToSteam: boolean;
  /** Review my demos automatically after processing (absent on older servers). */
  autoReview?: AutoReviewSettingsDto;
};
export type AutoReviewSettingsDto = {
  enabled: boolean;
  tier: "quick" | "deep";
  lang: "en" | "pt";
};
/** GET /v1/matches/auto-reviews?ids= item (jobs without an item were not considered). */
export type AutoReviewStatusDto = {
  jobId: string;
  status: "queued" | "running" | "done" | "skipped" | "failed";
  reason?:
    | "not_in_demo"
    | "insufficient_credits"
    | "disabled"
    | "daily_cap"
    | "ai_unavailable"
    | "error";
  reviewId?: string;
};
export type AutoReviewStatusListDto = { items: AutoReviewStatusDto[] };
/** POST /v1/analyses/:id/team-review body. */
export type TeamReviewRequest = { steamId: string; lang?: "en" | "pt" };
/** POST /v1/analyses/:id/team-review. */
export type TeamReviewResponseDto = {
  reviewId: string;
  creditsSpent: number;
  balance: number;
  call: { latencyMs: number; attempts: number } & Record<string, unknown>;
  teamReview: TeamReview;
};
/** GET /v1/analyses/:id/team-reviews?steamId=. */
export type TeamReviewListDto = {
  analysisId: string;
  steamId: string;
  reviews: {
    reviewId: string;
    steamId: string;
    createdAt: string;
    creditsSpent: number;
    promptVersion: string;
    lang: string;
    rating: number | null;
    provider?: string;
    model?: string;
    teamReview: TeamReview;
  }[];
};
/** GET /v1/analyses/:id/lobby?steamId=. */
export type LobbyDto = LobbyComparison & { analysisId: string };

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

/** @deprecated The pre-journey progress point (replaced by ProgressTimelineEntryDto). */
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
export type ProgressMetricKey =
  | "adr"
  | "kd"
  | "kast"
  | "hsPct"
  | "accuracy"
  | "tradedDeathsPct"
  | "openingWinPct"
  | "utilityDamagePerRound"
  | "crosshairMedianDeg"
  | "isolatedDeathsPct";
export type ProgressMetricsDto = Partial<Record<ProgressMetricKey, number>>;
export type TargetMetricDto = ProgressMetricKey | "none";
/** A plan item of a review on the progress timeline (id = `${reviewId}:${index}`). */
export type ProgressPlanItemDto = {
  id: string;
  text: string;
  scope: "map" | "general";
  map?: string;
  targetMetric: TargetMetricDto;
  direction: "up" | "down";
};
export type AdherenceDto = {
  planItemId: string;
  text: string;
  fromAnalysisId: string;
  status: "applied" | "partly" | "not_applied" | "unknown";
  metric: TargetMetricDto;
  before: number | null;
  after: number | null;
  /** Meaningful change for the metric (null for "none"). */
  threshold: number | null;
};
/** One match of the tracked player (GET /v1/coach/progress `timeline`, oldest first). */
export type ProgressTimelineEntryDto = {
  analysisId: string;
  playedAt: string;
  /** Demo dates are not readable from Valve file names: the upload time is used. */
  dateSource: "upload";
  map: string | null;
  result: {
    roundsWon: number | null;
    roundsLost: number | null;
    won: boolean | null;
  };
  metrics: ProgressMetricsDto;
  deltaVsPrevious: ProgressMetricsDto;
  review?: {
    reviewId: string;
    tier: "quick" | "deep";
    createdAt: string;
    verdict?: string;
    planItems: ProgressPlanItemDto[];
  };
  /** How the plan of the latest earlier review was applied in this match. */
  adherence?: AdherenceDto[];
};
export type ProgressTrendDto = {
  /** Change per match (least squares over the last up-to-10 matches). */
  slope: number;
  n: number;
  confidence: "low" | "medium" | "high";
};
export type ProgressMatchRefDto = {
  analysisId: string;
  playedAt: string;
  map: string | null;
  adr: number;
};
export type ProgressSummaryDto = {
  matches: number;
  firstPlayedAt: string | null;
  lastPlayedAt: string | null;
  trend: Partial<Record<"adr" | "kd" | "kast" | "hsPct", ProgressTrendDto>>;
  /** (applied + 0.5 * partly) / judged plan items; null when nothing was judged. */
  planAdherenceRate: number | null;
  bestMatch: ProgressMatchRefDto | null;
  worstMatch: ProgressMatchRefDto | null;
  streak: { kind: "win" | "loss"; count: number } | null;
};
/** Which player the account is in its demos. */
export type ProgressIdentityDto = {
  status: "steam" | "chosen" | "missing";
  candidates: {
    steamId: string;
    /** Display only. */
    name?: string;
    matches: number;
    reviews: number;
  }[];
};
/** GET /v1/coach/progress?map= (only the account's own matches). */
export type CoachProgressDto = ProgressByMapDto & {
  identity: ProgressIdentityDto;
  playerSteamId: string | null;
  linkedToSteam: boolean;
  analyzedMatches: number;
  map?: string;
  profile: unknown;
  timeline: ProgressTimelineEntryDto[];
  summary: ProgressSummaryDto;
  reviews: ReviewSummaryDto[];
  liveCalls: LiveCallSummaryDto[];
};
/** PUT /v1/coach/identity body (analysisIds defaults to "all"). */
export type CoachIdentityRequest = {
  steamId: string;
  analysisIds?: string[] | "all";
};
export type CoachIdentityDto = {
  steamId: string;
  /** Matches now marked as yours by this choice. */
  updated: number;
  /** Your matches where this player appears. */
  matches: number;
};
/** GET /v1/matches/ownership?ids= and PATCH /v1/matches/:id/ownership. */
export type MatchOwnershipDto = {
  jobId: string;
  ownership: "mine" | "external";
  playerSteamId?: string;
  playerName?: string;
  matchedBy: "steam" | "chosen" | "user" | "none";
};
export type MatchOwnershipListDto = { items: MatchOwnershipDto[] };
export type MatchOwnershipRequest = {
  ownership: "mine" | "external";
  playerSteamId?: string;
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

/** GET /v1/coach/personal and POST /v1/coach/personal/generate (Pro). */
export type PersonalCoachDto = {
  latest: {
    id: string;
    createdAt: string;
    trigger: "manual" | "auto";
    plan: PersonalCoachPlan;
    provider?: string;
    model?: string;
  } | null;
  history: {
    id: string;
    createdAt: string;
    headline: string;
    basedOnMatches: number;
  }[];
  analyzedMatches: number;
  newMatchesSinceLast: number;
  nextAvailableAt: string | null;
  autoRegenerateAfterMatches: number;
};
