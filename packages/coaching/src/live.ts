import type { CoachLang } from "./languages.js";
import { z } from "zod";
import { AiError, type AiConfig, type ModelResult } from "./provider.js";
import { secureModelCall } from "./prompt-kit.js";
import type { GuardSpec } from "./security.js";
import type { Personalization } from "./index.js";
import { historyForMap, plansForMap } from "./learn.js";
import {
  customInstructionText,
  languageInstruction,
  languageReminder,
  personalizationPrompt,
  LIVE_OUTPUT_SCHEMA,
  LIVE_PROMPT_VERSION,
  LIVE_SYSTEM_PROMPT,
} from "./prompts.js";

const count = z.number().int().min(0).max(1000);
/** Only the player's own, numeric GSI fields are accepted; free text never reaches the model. */
export const liveCoachInputSchema = z
  .object({
    map: z
      .string()
      .regex(/^[a-z0-9_]{1,64}$/)
      .optional(),
    phase: z
      .string()
      .regex(/^[a-z_]{1,32}$/)
      .optional(),
    round: count.optional(),
    score: z
      .object({ ct: count.optional(), t: count.optional() })
      .strict()
      .optional(),
    own: z
      .object({
        kills: count.optional(),
        deaths: count.optional(),
        assists: count.optional(),
        health: z.number().int().min(0).max(100).optional(),
        armor: z.number().int().min(0).max(100).optional(),
      })
      .strict()
      .optional(),
    recentRounds: z
      .array(
        z
          .object({
            round: count,
            kills: count,
            died: z.boolean(),
            armorAtStart: z.number().int().min(0).max(100).optional(),
          })
          .strict(),
      )
      .max(40)
      .default([]),
    baseline: z
      .object({
        kd: z.number().finite().min(0).max(100).nullable(),
        killsPerRound: z.number().finite().min(0).max(100).nullable(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type LiveCoachInput = z.infer<typeof liveCoachInputSchema>;
export const BETWEEN_ROUNDS = new Set([
  "freezetime",
  "over",
  "warmup",
  "gameover",
  "intermission",
]);

const callSchema = z.object({
  call: z.string().min(1),
  why: z.string().min(1),
  focus: z.enum([
    "trade",
    "info",
    "tempo",
    "aim",
    "economy",
    "mindset",
    "closing",
    "keep",
  ]),
  confidence: z.enum(["low", "medium", "high"]),
});
export type LiveCall = z.infer<typeof callSchema> & { promptVersion: string };

/**
 * Asks the configured model for one IGL-style call for the next round. Refuses during live
 * action (fair-play: no mid-fight advice) and always performs a real provider call.
 */
export async function aiLiveCall(
  input: unknown,
  config: AiConfig,
  options: {
    lang?: CoachLang;
    fetch?: typeof fetch;
    personal?: Personalization;
  } = {},
): Promise<{ call: LiveCall; meta: Omit<ModelResult, "data"> }> {
  const data = liveCoachInputSchema.parse(input);
  if (data.phase === "live")
    throw new AiError(
      "between_rounds_only",
      "The live coach only speaks between rounds.",
    );
  const perMap = options.personal?.perMapLearning ?? true;
  const history = historyForMap(options.personal?.history, data.map, perMap);
  const plans = plansForMap(options.personal?.previousPlans, data.map, perMap);
  const lang = options.lang ?? "en";
  const prefs = options.personal?.preferences;
  const secured = await secureModelCall({
    purpose: "live",
    config,
    system: (b) =>
      languageReminder(lang) +
      "\n\n" +
      LIVE_SYSTEM_PROMPT +
      (prefs ? personalizationPrompt(prefs, b) : "") +
      languageInstruction(lang),
    ...(prefs ? { customText: customInstructionText(prefs) } : {}),
    reminder: languageReminder(lang),
    payload: {
      ...data,
      recentRounds: data.recentRounds.slice(-12),
      ...(history ? { playerHistory: history } : {}),
      ...(plans.general.length || plans.thisMap.length
        ? { previousPlans: plans }
        : {}),
    },
    schemaName: "cs2_live_call",
    schema: LIVE_OUTPUT_SCHEMA,
    guard: LIVE_GUARD,
    lang,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  const parsed = callSchema.safeParse(secured.data);
  if (!parsed.success)
    throw new AiError(
      "invalid_output",
      "The model's live call did not match the expected format.",
    );
  const meta = secured.meta;
  return {
    call: {
      call: parsed.data.call.trim().slice(0, 140),
      why: parsed.data.why.trim().slice(0, 300),
      focus: parsed.data.focus,
      confidence: data.recentRounds.length < 3 ? "low" : parsed.data.confidence,
      promptVersion: LIVE_PROMPT_VERSION,
    },
    meta,
  };
}

/** Both live fields are critical: an unsafe call or reason rejects the answer. */
export const LIVE_GUARD: GuardSpec = {
  fields: ["call", "why"],
  critical: ["call", "why"],
  caps: { call: 140, why: 300 },
};
