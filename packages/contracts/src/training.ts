import { z } from "zod";

/**
 * Training layer of a review (additive `training` field of review responses and
 * GET /v1/analyses/:id/training). Computed in code from the stored analysis and replay:
 * resources, commands, coordinates and Workshop ids never come from a model.
 */
const id = z.string().min(1).max(128);
const text = z.string().max(400);
const num = z.number().finite();
const params = z.record(z.string().max(40), z.union([z.string().max(80), num]));

export const trainingStepSchema = z.enum([
  "review",
  "warmup",
  "habit",
  "focus",
  "debrief",
]);
export const trainingSkillSchema = z.enum([
  "aim",
  "crosshair",
  "utility",
  "spray",
  "movement",
  "positioning",
]);
export const teleportKindSchema = z.enum([
  "death",
  "enemy",
  "lineup",
  "teamflash",
  "crosshair",
]);
const clip = z.object({
  round: z.number().int().positive(),
  from: z.number().nonnegative(),
  to: z.number().nonnegative(),
  focusSteamId: id,
  eventIds: z.array(id).max(20),
  label: z.string().max(200).optional(),
});

export const teleportSchema = z.object({
  id,
  kind: teleportKindSchema,
  /** English label (the web builds its own from kind, callout and round). */
  label: text,
  round: z.number().int().positive().optional(),
  callout: z.string().max(64).optional(),
  grenade: z.enum(["flash", "he", "smoke", "molotov", "decoy"]).optional(),
  /** `setpos_exact x y z` (origin, world units). */
  setpos: z.string().max(80),
  /** `setang pitch yaw 0` (pitch positive = down, yaw 0 = +X). */
  setang: z.string().max(60),
  /** setpos and setang in one line. */
  command: z.string().max(160),
  /** enemy: from your death spot, look at the enemy's feet and place a bot there. */
  botPlace: z.string().max(200).optional(),
  /** The player was crouching (stand up or crouch to match). */
  crouched: z.boolean().optional(),
  /** Angles from replay samples (whole degrees, sampled): fine-tune in game. */
  approximate: z.boolean().optional(),
  x: num,
  y: num,
  z: num,
});
export type Teleport = z.infer<typeof teleportSchema>;

export const trainingSessionSchema = z.object({
  id,
  step: trainingStepSchema,
  skill: trainingSkillSchema.optional(),
  /** Template code + params: the web localizes title/why/successCriteria from them. */
  code: z.string().max(40),
  params,
  title: text,
  minutes: z.number().int().min(1).max(120),
  why: text,
  successCriteria: text,
  /** Catalog ids (see GET /v1/training/catalog). */
  resourceIds: z.array(id).max(4),
  /** Console commands to copy (practice config is separate). */
  commands: z.array(z.string().max(200)).max(12).optional(),
  teleportIds: z.array(id).max(12).optional(),
  clips: z.array(clip).max(3).optional(),
});
export type TrainingSession = z.infer<typeof trainingSessionSchema>;

export const trainingPlanSchema = z.object({
  version: z.literal("training-1"),
  map: z.string().max(64).optional(),
  side: z.enum(["CT", "T"]).optional(),
  area: z.string().max(64).optional(),
  role: z.enum(["entry", "support", "lurker", "anchor", "rifler"]).optional(),
  /** Weakest skills first (deterministic ranking). */
  focus: z.array(trainingSkillSchema).max(3),
  mindset: z.object({ code: z.string().max(40), text }),
  sessions: z.array(trainingSessionSchema).max(8),
  practiceConfig: z.array(z.string().max(80)).max(20),
  /** How to start the private server (official map) and load the config. */
  serverSetup: z.array(z.string().max(80)).max(4),
  teleports: z.array(teleportSchema).max(16),
  caveats: z.array(text).max(6),
});
export type TrainingPlan = z.infer<typeof trainingPlanSchema>;

export const catalogEntrySchema = z.object({
  id,
  skill: trainingSkillSchema,
  title: z.string().max(120),
  kind: z.enum(["workshop", "official"]),
  workshopId: z.string().regex(/^[0-9]{6,12}$/).optional(),
  mapName: z.string().max(64).optional(),
  maps: z.array(z.string().max(32)).max(12).optional(),
  url: z.string().max(200),
  minutesPerSession: z.number().int().min(1).max(120),
  howTo: z.array(z.string().max(200)).max(6),
  tags: z.array(z.string().max(40)).max(8),
  links: z.object({
    steam: z.string().max(200).optional(),
    web: z.string().max(200).optional(),
    launch: z.string().max(60),
    command: z.string().max(80).optional(),
  }),
  /** From the committed Steam verification snapshot. */
  verified: z
    .object({ at: z.string().max(40), subscriptions: z.number().nullable() })
    .optional(),
});
export type CatalogEntryDto = z.infer<typeof catalogEntrySchema>;

/** One day of the weekly practice program (Personal Coach and /training). */
export const practiceDaySchema = z.object({
  day: z.number().int().min(1).max(7),
  rest: z.boolean(),
  focus: trainingSkillSchema.optional(),
  steps: z
    .array(
      z.object({
        step: trainingStepSchema,
        minutes: z.number().int().min(1).max(120),
        skill: trainingSkillSchema.optional(),
        resourceId: id.optional(),
      }),
    )
    .max(6),
});
export type PracticeDay = z.infer<typeof practiceDaySchema>;
