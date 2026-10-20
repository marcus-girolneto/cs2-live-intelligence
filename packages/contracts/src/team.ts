import { z } from "zod";
import {
  clipSchema,
  coachingScopeSchema,
  confidenceSchema,
  targetMetricSchema,
  verificationSchema,
} from "./platform.js";

/**
 * Team review (prompt igl-team-v5): one AI call that reviews the coached player's whole team
 * (up to 5 players) as an IGL would. Team facts and scores are computed in code; the model only
 * explains and prioritises them. Players are referred to by Steam id here; the model only ever
 * saw stable aliases (P1-P5) and never a name; every human-readable field gets the players' display
 * names back server-side before it is saved or shown (team/names.ts).
 */
const id = z.string().min(1).max(128);
const text = (max: number) => z.string().max(max);
const evidenceIds = z.array(id).max(12);

export const teamScoreSchema = z.object({
  value: z.number().int().min(0).max(100),
  label: z.enum(["poor", "below", "average", "good", "elite"]),
  basis: z.string().max(500),
});
export const TEAM_SCORE_DIMENSIONS = [
  "trading",
  "utility",
  "opening",
  "economy",
  "conversion",
] as const;
export const teamRoleSchema = z.enum([
  "entry",
  "support",
  "lurker",
  "awper",
  "anchor",
  "flex",
]);
/** A citable team fact (ids start with "team-"). */
export const teamFactSchema = z.object({
  id,
  kind: z.string().max(64),
  /** Steam id of the player the fact is about (absent: the whole team). */
  steamId: id.optional(),
  value: z.number().optional(),
  /** Sample size behind the value (duels, rounds, throws...). */
  n: z.number().int().nonnegative(),
  confidence: confidenceSchema,
  description: z.string().max(300),
  eventIds: z.array(id).max(60),
});
export type TeamFact = z.infer<typeof teamFactSchema>;
const point = z.object({ text: text(300), evidenceIds });
export const teamReviewSchema = z.object({
  schemaVersion: z.literal("1.0"),
  map: z.string().max(64).optional(),
  /** The team of the requesting player (Steam ids, in alias order P1..P5). */
  members: z.array(id).max(5),
  verdict: text(120),
  /** Deterministic 0-100 ratings of the team versus the enemy team; never produced by the model. */
  teamScores: z.object({
    trading: teamScoreSchema.optional(),
    utility: teamScoreSchema.optional(),
    opening: teamScoreSchema.optional(),
    economy: teamScoreSchema.optional(),
    conversion: teamScoreSchema.optional(),
  }),
  roles: z
    .array(
      z.object({
        steamId: id,
        /** Inferred in code from first-contact order, positions and weapons. */
        role: teamRoleSchema,
        strengths: z.array(point).max(3),
        fixes: z.array(point).max(3),
      }),
    )
    .max(5),
  patterns: z
    .array(
      z.object({
        scope: coachingScopeSchema,
        map: z.string().max(64).optional(),
        text: text(400),
        evidenceIds: evidenceIds.min(1),
        confidence: confidenceSchema,
        clips: z.array(clipSchema).max(3),
      }),
    )
    .max(8),
  keyRounds: z
    .array(
      z.object({
        round: z.number().int().positive(),
        title: text(120),
        whatHappened: text(600),
        whatToDoInstead: text(600),
        eventIds: z.array(id).max(20),
        clip: clipSchema.optional(),
      }),
    )
    .max(8),
  plan: z
    .array(
      z.object({
        text: text(300),
        /** A member's Steam id, or "team". */
        owner: z.union([id, z.literal("team")]),
        targetMetric: targetMetricSchema.optional(),
        direction: z.enum(["up", "down"]).optional(),
      }),
    )
    .max(5),
  /** The citable facts the review was built on. */
  facts: z.array(teamFactSchema).max(200),
  provenance: z
    .object({
      promptVersion: z.string(),
      model: z.string().optional(),
      variant: z.enum(["a", "b"]).optional(),
      verification: verificationSchema.optional(),
    })
    .optional(),
  caveats: z.array(z.string().max(1000)).max(20),
});
export type TeamReview = z.infer<typeof teamReviewSchema>;

/** GET /v1/analyses/:id/lobby?steamId= ("You vs the lobby", deterministic, free). */
export const lobbyMetricSchema = z.object({
  key: z.string().max(64),
  label: z.string().max(64),
  unit: z.string().max(8),
  lowerIsBetter: z.boolean(),
  value: z.number().nullable(),
  /** 1 = best in the lobby; null when the player has no value. */
  rank: z.number().int().positive().nullable(),
  lobbyMedian: z.number().nullable(),
  best: z.number().nullable(),
  /** Players with a value for this metric. */
  players: z.number().int().nonnegative(),
});
export const lobbyComparisonSchema = z.object({
  steamId: id,
  players: z.number().int().nonnegative(),
  metrics: z.array(lobbyMetricSchema),
});
export type LobbyComparison = z.infer<typeof lobbyComparisonSchema>;
