import { z } from "zod";

/**
 * Deterministic "deep review" modules (coaching.deep, prompt igl-review-v7-deep). Computed in
 * code from the analysis events and the replay samples; the model only explains them. Every
 * number is optional where the data may be missing: absent means unknown, never zero.
 */
const id = z.string().min(1).max(128);
const count = z.number().int().nonnegative();
const num = z.number().finite();
const place = z.string().max(64);
const point = z.object({ x: num, y: num });
const nade = z.enum(["flash", "he", "smoke", "molotov", "decoy"]);
/** A replay window (same shape as coaching clips; repeated here to avoid a cycle). */
const deepClip = z.object({
  round: z.number().int().positive(),
  from: z.number().nonnegative(),
  to: z.number().nonnegative(),
  focusSteamId: id,
  eventIds: z.array(id).max(20),
  label: z.string().max(200).optional(),
});
const evidenceIds = z.array(id).max(40);

/** One grenade the player threw. */
export const utilityThrowSchema = z.object({
  eventId: id,
  type: nade,
  round: z.number().int().positive(),
  /** Seconds since freeze-time end at detonation / effect start. */
  time: num.nonnegative(),
  /** The thrower's callout when the grenade went off. */
  fromPlace: place.optional(),
  /** Nearest known callout to the landing point (inferred from the match's own positions). */
  landingPlace: place.optional(),
  from: point.optional(),
  landing: point.optional(),
  enemiesFlashed: count,
  enemyBlindSeconds: num.nonnegative(),
  teammatesFlashed: count,
  /** Health damage to enemies (HE: at detonation; molotov: while burning, ≤ 7 s). */
  damage: count,
  teamDamage: count,
  /** good = blinded/damaged an enemy (smokes/decoys: thrown), harmful = only hurt teammates. */
  verdict: z.enum(["good", "wasted", "harmful"]),
});
const flashStats = z.object({
  thrown: count,
  enemiesFlashed: count,
  enemiesPerFlash: num.nonnegative().nullable(),
  blindSecondsPerFlash: num.nonnegative().nullable(),
  teammatesFlashed: count,
  /** Teammates blinded / (teammates + enemies blinded), in %. */
  teamFlashRate: num.min(0).max(100).nullable(),
  /** Flashes that blinded at least one enemy, in %. */
  effectivePct: num.min(0).max(100).nullable(),
});
const damageStats = z.object({
  thrown: count,
  damage: count,
  damagePerNade: num.nonnegative().nullable(),
});
export const utilitySchema = z.object({
  thrown: count,
  perType: z
    .array(
      z.object({
        type: nade,
        thrown: count,
        effective: count,
        damage: count,
        enemiesFlashed: count,
        blindSeconds: num.nonnegative(),
        /** effective / thrown, in %. */
        efficiency: num.min(0).max(100).nullable(),
      }),
    )
    .max(5),
  stats: z.object({
    flash: flashStats,
    he: damageStats,
    molotov: damageStats.extend({
      /** Burning time is not derivable from the demo (see parser README). */
      areaDenialSeconds: num.nonnegative().nullable(),
    }),
    smoke: z.object({
      thrown: count,
      byCallout: z.array(z.object({ place, count })).max(20),
    }),
  }),
  /** Deaths with grenades still in the inventory (only when the parser could read it). */
  unusedAtDeath: z
    .object({
      deaths: count,
      deathsWithUtility: count,
      grenades: z.record(nade, count),
    })
    .optional(),
  grenades: z.array(utilityThrowSchema).max(200),
  lineups: z
    .array(
      z.object({
        /** repeat = one of your most effective throws; learn = what the lobby used where you die. */
        kind: z.enum(["repeat", "learn"]),
        title: z.string().max(120),
        type: nade,
        place: place.optional(),
        fromPlace: place.optional(),
        from: point.optional(),
        landing: point.optional(),
        count: count,
        why: z.string().max(300),
        eventIds: z.array(id).max(20),
        clip: deepClip.optional(),
      }),
    )
    .max(8),
  evidenceIds,
});
export type DeepUtility = z.infer<typeof utilitySchema>;

/** One measured duel: crosshair vs the direction to the enemy just before the first shot. */
export const crosshairDuelSchema = z.object({
  eventId: id,
  round: z.number().int().positive(),
  time: num.nonnegative(),
  enemyId: id,
  place: place.optional(),
  /** Absolute horizontal / vertical / total angle between view and target, degrees. */
  yawOffset: num.nonnegative(),
  pitchOffset: num.nonnegative(),
  offset: num.nonnegative(),
  /** Signed vertical error: positive = crosshair above the target, negative = below. */
  pitchError: num,
  distance: num.nonnegative(),
  won: z.boolean().optional(),
});
export const crosshairSchema = z.object({
  /** Duels found in the events / measured with replay samples. */
  duels: count,
  measured: count,
  medianOffset: num.nonnegative().nullable(),
  medianYawOffset: num.nonnegative().nullable(),
  medianPitchOffset: num.nonnegative().nullable(),
  /** Measured duels with total offset < 5°, in %. */
  preAimedPct: num.min(0).max(100).nullable(),
  /** Mean signed pitch error (degrees, positive = too high). */
  pitchBias: num.nullable(),
  pitchTendency: z.enum(["too_low", "too_high", "level"]).nullable(),
  histogram: z.array(z.object({ from: num, to: num.nullable(), count })).max(8),
  worstCallouts: z
    .array(z.object({ place, medianOffset: num.nonnegative(), duels: count }))
    .max(5),
  samples: z.array(crosshairDuelSchema).max(80),
  evidenceIds,
});
export type DeepCrosshair = z.infer<typeof crosshairSchema>;

export const positioningDeathSchema = z.object({
  eventId: id,
  round: z.number().int().positive(),
  time: num.nonnegative(),
  place: place.optional(),
  /** World units to the nearest living teammate (null: none alive / no replay). */
  nearestTeammate: num.nonnegative().nullable(),
  traded: z.boolean(),
  /** Distinct enemies that damaged you in the 5 s before death. */
  crossfireEnemies: count,
  /** Seconds you had stayed within 150 units of the death spot (null: no replay). */
  holdSeconds: num.nonnegative().nullable(),
  /** Killed by an unusual opponent: not counted against the player in aggregates. */
  excluded: z.literal("unusual_opponent").optional(),
});
export const positioningSchema = z.object({
  deaths: count,
  avgIsolation: num.nonnegative().nullable(),
  /** Deaths with no teammate alive within 800 units, in %. */
  isolatedPct: num.min(0).max(100).nullable(),
  tradedPct: num.min(0).max(100).nullable(),
  /** Deaths where 2+ enemies damaged you in the last 5 s, in %. */
  crossfirePct: num.min(0).max(100).nullable(),
  avgHoldSeconds: num.nonnegative().nullable(),
  byCallout: z
    .array(
      z.object({
        place,
        deaths: count,
        traded: count,
        avgIsolation: num.nonnegative().nullable(),
        avgCrossfire: num.nonnegative(),
      }),
    )
    .max(20),
  dangerZones: z
    .array(
      z.object({
        place,
        deaths: count,
        rounds: z.array(z.number().int().positive()).max(40),
        why: z.string().max(300),
        clips: z.array(deepClip).max(3),
      }),
    )
    .max(5),
  deathsDetail: z.array(positioningDeathSchema).max(60),
  evidenceIds,
});
export type DeepPositioning = z.infer<typeof positioningSchema>;

export const roundRowSchema = z.object({
  round: z.number().int().positive(),
  side: z.enum(["CT", "T"]).optional(),
  won: z.boolean().optional(),
  buy: z.enum(["pistol", "eco", "force", "full"]).optional(),
  equipmentValue: count.optional(),
  utilityThrown: count,
  kills: count,
  damage: count,
  died: z.boolean(),
  deathTime: num.optional(),
  tag: z.enum(["mistake", "highlight"]).nullable(),
  /** Machine reasons, e.g. multi_kill, opening_kill, clutch_win, untraded_death, early_death, zero_damage, saved_utility. */
  tags: z.array(z.string().max(32)).max(6),
  note: z.string().max(200).optional(),
});
export const historyChipSchema = z.object({
  key: z.string().max(40),
  label: z.string().max(80),
  current: num,
  baseline: num,
  unit: z.string().max(8),
  better: z.enum(["lower", "higher"]),
  matches: count,
});
export const deepSchema = z.object({
  utility: utilitySchema.optional(),
  crosshair: crosshairSchema.optional(),
  positioning: positioningSchema.optional(),
  rounds: z.array(roundRowSchema).max(60),
  /** Pro: this match versus your previous deep reviews on the same map. */
  history: z.array(historyChipSchema).max(8).optional(),
  /** What could not be computed and why (e.g. no replay samples). */
  caveats: z.array(z.string().max(300)).max(10),
});
export type DeepReview = z.infer<typeof deepSchema>;
