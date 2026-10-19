import { z } from "zod";
import { deepSchema } from "./deep.js";
const id = z.string().min(1).max(128);
export const pairingRequestSchema = z
  .object({ name: z.string().min(1).max(80) })
  .strict();
export const pairingClaimSchema = z
  .object({ code: z.string().min(6).max(128) })
  .strict();
export const settingsSchema = z
  .object({
    telemetryConsent: z.boolean(),
    analyticsConsent: z.boolean(),
    /** Clamped server-side to the plan maximum (365 on the largest plan). */
    retentionDays: z.number().int().min(1).max(365),
  })
  .strict();
export const teamSchema = z.enum(["CT", "T", "spectator", "unassigned"]);
const common = {
  id,
  tick: z.number().int().nonnegative(),
  round: z.number().int().positive(),
};
const vec = z.object({ x: z.number(), y: z.number(), z: z.number() });
const place = z.string().max(64).optional();
/** Hit location reported by the game for a damage event. */
export const hitgroupSchema = z.enum([
  "head",
  "chest",
  "stomach",
  "left_arm",
  "right_arm",
  "left_leg",
  "right_leg",
  "neck",
  "generic",
]);
export const grenadeSchema = z.enum([
  "flash",
  "he",
  "smoke",
  "molotov",
  "decoy",
]);
/**
 * Demo events. Fields after the original 1.0 set are optional enrichment (parser
 * cs2live.2+): positions are world coordinates, `place` is the in-game callout name
 * (e.g. "TopofMid"), `roundTime` is seconds since the end of freeze time.
 */
export const demoEventSchema = z.discriminatedUnion("type", [
  z.object({
    ...common,
    type: z.literal("kill"),
    attackerId: id.optional(),
    victimId: id,
    attackerTeam: teamSchema.optional(),
    victimTeam: teamSchema.optional(),
    headshot: z.boolean(),
    weapon: z.string().max(64).optional(),
    assisterId: id.optional(),
    flashAssist: z.boolean().optional(),
    penetrated: z.boolean().optional(),
    noScope: z.boolean().optional(),
    throughSmoke: z.boolean().optional(),
    attackerBlind: z.boolean().optional(),
    distance: z.number().nonnegative().optional(),
    attackerPos: vec.optional(),
    victimPos: vec.optional(),
    attackerPlace: place,
    victimPlace: place,
    roundTime: z.number().optional(),
    /** Grenades the victim still carried (parser cs2live.3+); absent = unknown. */
    victimGrenades: z.array(z.string().max(16)).max(8).optional(),
  }),
  z.object({
    ...common,
    type: z.literal("damage"),
    attackerId: id.optional(),
    victimId: id,
    attackerTeam: teamSchema.optional(),
    victimTeam: teamSchema.optional(),
    healthDamage: z.number().int().min(0).max(100),
    armorDamage: z.number().int().min(0).max(100).optional(),
    weapon: z.string().max(64).optional(),
    hitgroup: hitgroupSchema.optional(),
    /** Callout the attacker stood in when the damage was dealt. */
    attackerPlace: place,
    roundTime: z.number().optional(),
  }),
  z.object({
    ...common,
    type: z.literal("round_end"),
    winner: z.enum(["CT", "T"]).optional(),
    reason: z.string().max(64).optional(),
  }),
  /** One trigger pull (gun weapons only). */
  z.object({
    ...common,
    type: z.literal("shot"),
    shooterId: id,
    shooterTeam: teamSchema.optional(),
    weapon: z.string().max(64),
    roundTime: z.number().optional(),
  }),
  /** Grenade detonation/effect start. */
  z.object({
    ...common,
    type: z.literal("grenade"),
    throwerId: id,
    throwerTeam: teamSchema.optional(),
    grenade: grenadeSchema,
    pos: vec.optional(),
    place,
    roundTime: z.number().optional(),
  }),
  /** A player blinded by a flashbang. */
  z.object({
    ...common,
    type: z.literal("flashed"),
    attackerId: id,
    victimId: id,
    attackerTeam: teamSchema.optional(),
    victimTeam: teamSchema.optional(),
    durationSeconds: z.number().nonnegative().max(10),
  }),
  z.object({
    ...common,
    type: z.literal("bomb"),
    action: z.enum(["plant", "defuse", "explode"]),
    playerId: id.optional(),
    site: z.enum(["A", "B"]).optional(),
    roundTime: z.number().optional(),
  }),
]);
export const normalizedDemoSchema = z.object({
  schemaVersion: z.literal("1.0"),
  parserVersion: z.string(),
  map: z.string().optional(),
  complete: z.boolean(),
  completeness: z.object({
    kills: z.boolean(),
    damage: z.boolean(),
    rounds: z.boolean(),
  }),
  players: z
    .array(z.object({ steamId: id, name: z.string().max(128).optional() }))
    .max(128),
  rounds: z
    .array(
      z.object({
        number: z.number().int().positive(),
        participants: z.array(id).max(128),
        winner: z.enum(["CT", "T"]).optional(),
        reason: z.string().max(64).optional(),
        /** Per-player state at freeze-time end (parser cs2live.2+). */
        economy: z
          .array(
            z.object({
              steamId: id,
              team: teamSchema.optional(),
              equipmentValue: z.number().int().nonnegative(),
              money: z.number().int().nonnegative().optional(),
              primary: z.string().max(64).optional(),
              armor: z.number().int().min(0).max(100).optional(),
              helmet: z.boolean().optional(),
            }),
          )
          .max(128)
          .optional(),
      }),
    )
    .max(1000),
  /** Server tick rate (e.g. 64) when the parser can determine it. */
  tickRate: z.number().positive().max(1024).optional(),
  events: z.array(demoEventSchema).max(2000000),
});
export type NormalizedDemo = z.infer<typeof normalizedDemoSchema>;
export type DemoEvent = z.infer<typeof demoEventSchema>;
export const metricSchema = z.object({
  value: z.number().nullable(),
  numerator: z.number(),
  denominator: z.number(),
  complete: z.boolean(),
  formula: z.string(),
  evidenceIds: z.array(id),
});
export const evidenceSchema = z.object({
  id,
  kind: z.string(),
  description: z.string(),
  value: z.number().optional(),
  eventIds: z.array(id),
});
const count0 = z.number().int().nonnegative();
/** Detailed per-player breakdowns derived from enriched demo events. */
export const playerDetailSchema = z.object({
  /**
   * Gun shots fired (knife, Zeus, grenades and C4 excluded) and gun hits = damage events from
   * guns on enemies (one per bullet/pellet that hurt an enemy, so shotguns can exceed one hit per
   * shot). `hitgroups` sums to `hits`. For accuracy use advanced.accuracy, which counts each
   * shot at most once.
   */
  shots: count0.optional(),
  hits: count0.optional(),
  hitgroups: z.record(hitgroupSchema, count0).optional(),
  weapons: z
    .array(
      z.object({
        weapon: z.string().max(64),
        kills: count0,
        headshots: count0,
        damage: count0,
        shots: count0,
        hits: count0,
        /** Citable evidence for this weapon (accuracy/kills), when emitted. */
        evidenceId: id.optional(),
      }),
    )
    .max(64)
    .optional(),
  /** Callout-level performance (kills made from / deaths suffered at each place). */
  places: z
    .array(
      z.object({
        place: z.string().max(64),
        kills: count0,
        deaths: count0,
        damage: count0,
        /** Citable evidence for this callout, when emitted (top callouts only). */
        evidenceId: id.optional(),
      }),
    )
    .max(200)
    .optional(),
  /** Kill/death markers for map plots (world coordinates). */
  positions: z
    .array(
      z.object({
        kind: z.enum(["kill", "death"]),
        round: z.number().int().positive(),
        x: z.number(),
        y: z.number(),
        place: z.string().max(64).optional(),
        weapon: z.string().max(64).optional(),
        headshot: z.boolean().optional(),
        eventId: id,
      }),
    )
    .max(2000)
    .optional(),
  timing: z
    .object({
      /** Seconds after freeze time of the player's opening duels / deaths / first kills. */
      avgOpeningTime: z.number().nullable(),
      avgDeathTime: z.number().nullable(),
      avgFirstKillTime: z.number().nullable(),
      /** Deaths in the first 20 s of a round. */
      earlyDeaths: count0,
    })
    .optional(),
  utility: z
    .object({
      flashes: count0,
      smokes: count0,
      hes: count0,
      molotovs: count0,
      enemiesFlashed: count0,
      teammatesFlashed: count0,
      enemyBlindSeconds: z.number().nonnegative(),
      flashAssists: count0,
      utilityDamage: count0,
    })
    .optional(),
  economy: z
    .object({
      avgEquipmentValue: z.number().nullable(),
      /** Rounds by own buy type: eco < $1500, force < $3500 (T) / $4000 (CT), else full. */
      buys: z.object({
        eco: count0,
        force: count0,
        full: count0,
        pistol: count0,
      }),
      /** Kills (outside pistol rounds) on an enemy whose equipment value was under $1500 and at least $1000 below yours, at freeze-time end. */
      antiEcoKills: count0.optional(),
    })
    .optional(),
  /** Mean distance to killed enemies, in meters (game-reported). */
  avgKillDistance: z.number().nullable().optional(),
  /** Analysis evidence ids for the citable breakdown facts (weapons, callouts, hit groups, utility, economy). */
  evidenceIds: z.array(id).max(64).optional(),
});
export type PlayerDetail = z.infer<typeof playerDetailSchema>;
export const playerRoundSchema = z.object({
  round: z.number().int().positive(),
  side: z.enum(["CT", "T"]).optional(),
  kills: z.number().int().nonnegative(),
  headshots: z.number().int().nonnegative(),
  damage: z.number().int().nonnegative(),
  died: z.boolean(),
  traded: z.boolean(),
  damageAssist: z.boolean(),
  won: z.boolean().optional(),
  opening: z.enum(["kill", "death"]).optional(),
  clutchVs: z.number().int().positive().optional(),
  killedBy: id.optional(),
  /** Enrichment (parser cs2live.2+). */
  deathTime: z.number().optional(),
  deathPlace: z.string().max(64).optional(),
  equipmentValue: z.number().int().nonnegative().optional(),
  buyType: z.enum(["pistol", "eco", "force", "full"]).optional(),
  shots: z.number().int().nonnegative().optional(),
  hits: z.number().int().nonnegative().optional(),
});
export type PlayerRound = z.infer<typeof playerRoundSchema>;
export const playerMetricsSchema = z.object({
  steamId: id,
  /** Display-only, untrusted demo text; never interpreted as instructions. */
  name: z.string().max(128).optional(),
  kills: metricSchema,
  deaths: metricSchema,
  adr: metricSchema,
  headshotPercentage: metricSchema,
  /** Metric version 1.1 additions, keyed by metric kind. */
  advanced: z.record(z.string().max(64), metricSchema).optional(),
  rounds: z.array(playerRoundSchema).max(1000).optional(),
  /** Metric version 1.2 (parser cs2live.2+): detailed breakdowns. */
  detail: playerDetailSchema.optional(),
});
export const analysisSchema = z.object({
  schemaVersion: z.literal("1.0"),
  source: z.literal("demo"),
  map: z.string().optional(),
  provenance: z
    .object({ parserVersion: z.string(), metricVersion: z.string() })
    .optional(),
  roundOutcomes: z
    .array(
      z.object({
        round: z.number().int().positive(),
        winner: z.enum(["CT", "T"]).optional(),
      }),
    )
    .optional(),
  events: z.array(demoEventSchema).optional(),
  players: z.array(playerMetricsSchema),
  evidence: z.array(evidenceSchema),
  caveats: z.array(z.string()),
});
export type Analysis = z.infer<typeof analysisSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
/** "map": callouts, positions, map timings, side-on-this-map patterns; "general": transferable habits. */
export const coachingScopeSchema = z.enum(["map", "general"]);
/** A replay window (seconds since freeze-time end) centred on cited events. */
export const clipSchema = z.object({
  round: z.number().int().positive(),
  from: z.number().nonnegative(),
  to: z.number().nonnegative(),
  focusSteamId: id,
  eventIds: z.array(id).max(20),
  label: z.string().max(200).optional(),
});
export type Clip = z.infer<typeof clipSchema>;
const scoreSchema = z.object({
  value: z.number().int().min(0).max(100),
  label: z.enum(["poor", "below", "average", "good", "elite"]),
  basis: z.string().max(500),
});
export const SCORE_DIMENSIONS = [
  "aim",
  "positioning",
  "utility",
  "trading",
  "economy",
  "impact",
] as const;
export const reviewTierSchema = z.enum(["quick", "deep"]);
export type ReviewTier = z.infer<typeof reviewTierSchema>;
/** Practice area of a drill (deep reviews tag utility/crosshair/positioning drills). */
export const drillAreaSchema = z.enum([
  "utility",
  "crosshair",
  "positioning",
  "aim",
  "trading",
  "economy",
  "general",
]);
/** Progress metric a plan item targets ("none": not measurable by this app). */
export const TARGET_METRICS = [
  "adr",
  "kd",
  "kast",
  "hsPct",
  "accuracy",
  "tradedDeathsPct",
  "openingWinPct",
  "utilityDamagePerRound",
  "crosshairMedianDeg",
  "isolatedDeathsPct",
  "none",
] as const;
export const targetMetricSchema = z.enum(TARGET_METRICS);
export type TargetMetric = z.infer<typeof targetMetricSchema>;
export const confidenceSchema = z.enum(["low", "medium", "high"]);
/** Verifier and deterministic claim checks applied to a review (provider mode). */
export const verificationSchema = z.object({
  /** Human-readable claims checked. */
  claims: z.number().int().nonnegative(),
  supported: z.number().int().nonnegative(),
  dropped: z.number().int().nonnegative(),
  /** Claims replaced by the verifier's corrected text or a deterministic fix. */
  corrected: z.number().int().nonnegative(),
  /** Claims failing the deterministic number / "consecutive" checks. */
  numberFailures: z.number().int().nonnegative(),
  /** Whether the second-model verifier ran (false: disabled or failed; checks still ran). */
  verifier: z.boolean(),
  verifierModel: z.string().max(200).optional(),
});
export type Verification = z.infer<typeof verificationSchema>;
export const coachingSchema = z.object({
  schemaVersion: z.literal("1.0"),
  mode: z.enum(["offline", "provider"]),
  /** Review tier (absent on reviews made before tiers existed = quick). */
  tier: reviewTierSchema.optional(),
  /** The analysis map, when known (scope "map" items refer to it). */
  map: z.string().max(64).optional(),
  /** Punchy headline, at most 90 characters (provider mode, v5+). */
  verdict: z.string().max(90).optional(),
  /** Short overall verdict written by the model (provider mode). */
  summary: z.string().max(2000).optional(),
  /** Ordered priorities for the next match (provider mode). */
  plan: z.array(z.string().max(300)).max(5).optional(),
  /** The same priorities with their scope (v5+). */
  planItems: z
    .array(
      z.object({
        text: z.string().max(300),
        scope: coachingScopeSchema,
        map: z.string().max(64).optional(),
        /** Metric the next matches are measured on (v8+; inferred for older reviews). */
        targetMetric: targetMetricSchema.optional(),
        direction: z.enum(["up", "down"]).optional(),
      }),
    )
    .max(5)
    .optional(),
  provenance: z
    .object({
      promptVersion: z.string(),
      model: z.string().optional(),
      /** Prompt A/B variant that produced the review. */
      variant: z.enum(["a", "b"]).optional(),
      verification: verificationSchema.optional(),
    })
    .optional(),
  /**
   * Deaths not counted against the player: the killer had a "high" integrity level or was
   * banned after the match (see analysis.integrity). Never names the opponent.
   */
  excludedDeaths: z
    .object({
      reason: z.literal("unusual_opponent"),
      count: z.number().int().nonnegative(),
      eventIds: z.array(id).max(60),
    })
    .optional(),
  insights: z
    .array(
      z.object({
        observation: z.string().max(2000),
        evidenceIds: z.array(id).min(1),
        confidence: z.enum(["low", "medium", "high"]),
        actionablePractice: z.string().max(2000),
        caveats: z.array(z.string().max(1000)),
        kind: z.enum(["strength", "improve"]).optional(),
        scope: coachingScopeSchema.optional(),
        /** Server-computed replay windows around the cited events (max 3). */
        clips: z.array(clipSchema).max(3).optional(),
      }),
    )
    .max(8),
  /** Deterministic 0-100 ratings versus the lobby; never produced by the model. */
  scores: z
    .object({
      aim: scoreSchema.optional(),
      positioning: scoreSchema.optional(),
      utility: scoreSchema.optional(),
      trading: scoreSchema.optional(),
      economy: scoreSchema.optional(),
      impact: scoreSchema.optional(),
    })
    .optional(),
  keyMoments: z
    .array(
      z.object({
        eventId: id,
        round: z.number().int().positive(),
        time: z.number().nonnegative(),
        title: z.string().max(120),
        whatHappened: z.string().max(600),
        whatToDoInstead: z.string().max(600),
        kind: z.enum(["mistake", "highlight"]),
        scope: coachingScopeSchema.optional(),
        clip: clipSchema,
      }),
    )
    // Quick reviews keep at most 6; deep reviews up to 10.
    .max(10)
    .optional(),
  drills: z
    .array(
      z.object({
        name: z.string().max(120),
        durationMinutes: z.number().int().min(1).max(120),
        howTo: z.string().max(800),
        metric: z.string().max(300),
        scope: coachingScopeSchema.optional(),
        map: z.string().max(64).optional(),
        area: drillAreaSchema.optional(),
      }),
    )
    // Quick reviews keep at most 4; deep reviews up to 6.
    .max(6)
    .optional(),
  /** Deep tier only: deterministic utility, crosshair, positioning and round modules. */
  deep: deepSchema.optional(),
  caveats: z.array(z.string()),
});
export type Coaching = z.infer<typeof coachingSchema>;
export const feedbackSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(2000).optional(),
  })
  .strict();
