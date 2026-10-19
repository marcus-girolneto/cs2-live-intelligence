import {
  analysisSchema,
  coachingSchema,
  type Analysis,
  type Coaching,
} from "@cs2/contracts";
import {
  matchAverages,
  offlinePlayerCoaching,
  playerInsights,
  type CoachLang,
} from "./player.js";
import {
  AiError,
  callModel,
  type AiConfig,
  type ModelResult,
} from "./provider.js";
import {
  languageInstruction,
  languageReminder,
  personalizationPrompt,
  POST_MATCH_PROMPT_VERSION,
  POST_MATCH_SYSTEM_PROMPT,
  type CoachPreferences,
} from "./prompts.js";
import {
  historyForMap,
  plansForMap,
  type LearnedProfile,
  type PreviousPlan,
} from "./learn.js";
import { deepContext, type DeepResult } from "./deep/index.js";
import { DEEP_PROMPT_VERSION, DEEP_SYSTEM_PROMPT } from "./prompts-deep.js";
import {
  insightClips,
  isMapEvidence,
  momentCandidates,
  momentClip,
  momentKind,
  contradictsOutcome,
  normalizeScope,
  playerScores,
} from "./review.js";
export {
  matchAverages,
  offlinePlayerCoaching,
  playerInsights,
  type CoachLang,
} from "./player.js";
export * from "./provider.js";
export * from "./prompts.js";
export * from "./live.js";
export * from "./learn.js";
export * from "./review.js";
export * from "./deep/index.js";
export * from "./prompts-deep.js";
export * from "./report.js";
export * from "./reel.js";

export interface CoachingOptions {
  /** Configured language model. Without it, only deterministic offline feedback is produced. */
  ai?: AiConfig;
  fetch?: typeof fetch;
  /** Limit facts and feedback to one player's evidence. */
  focusSteamId?: string;
  /** Output language. */
  lang?: CoachLang;
  /** Viewer preferences and what was learned from their previous matches. */
  personal?: Personalization;
  /** Review tier (default quick). Deep needs `deep` (computeDeep) for the focus player. */
  tier?: "quick" | "deep";
  deep?: DeepResult;
}
/** Item caps per tier (the contract allows the deep maxima). */
export const TIER_LIMITS = {
  quick: { keyMoments: 6, drills: 4 },
  deep: { keyMoments: 10, drills: 6 },
} as const;
export type Personalization = {
  preferences: CoachPreferences;
  history?: LearnedProfile | null;
  /** Earlier plans with their scope; other maps' map items are filtered out before prompting. */
  previousPlans?: PreviousPlan[];
  /** Plan feature: feed this map's learned history and plans (default true). */
  perMapLearning?: boolean;
};
export function validateCoaching(input: unknown, analysis: Analysis): Coaching {
  const result = coachingSchema.parse(input);
  const evidence = new Map(analysis.evidence.map((e) => [e.id, e]));
  for (const insight of result.insights)
    for (const id of insight.evidenceIds)
      if (evidence.get(id)?.value === undefined)
        throw new Error("Coaching cited unavailable or unknown evidence");
  return result;
}
export function offlineCoaching(input: unknown): Coaching {
  const analysis = analysisSchema.parse(input);
  const metric = analysis.players
    .flatMap((p) => [p.adr, p.headshotPercentage])
    .find((m) => m.complete && m.value !== null);
  return validateCoaching(
    {
      schemaVersion: "1.0",
      mode: "offline",
      provenance: { promptVersion: "deterministic-v1" },
      insights: metric
        ? [
            {
              observation: `Observed ${metric.formula}: ${metric.value} (${metric.numerator}/${metric.denominator}).`,
              evidenceIds: metric.evidenceIds,
              confidence: "high",
              actionablePractice:
                "Use a short aim practice session, then compare the same metric across additional complete demos before changing your routine.",
              caveats: [
                "This metric describes this demo only; it does not establish a skill deficit or cause.",
              ],
            },
          ]
        : [],
      caveats: [
        ...analysis.caveats,
        "Offline deterministic feedback; no language model was called.",
        ...(!metric
          ? ["Insufficient complete metric evidence for coaching."]
          : []),
      ],
    },
    analysis,
  );
}
const string = { type: "string" };
const scope = { type: "string", enum: ["map", "general"] };
const insightItem = {
  type: "object",
  additionalProperties: false,
  required: [
    "observation",
    "evidenceIds",
    "confidence",
    "actionablePractice",
    "caveats",
    "kind",
    "scope",
  ],
  properties: {
    observation: string,
    evidenceIds: { type: "array", items: string },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    actionablePractice: string,
    caveats: { type: "array", items: string },
    kind: { type: "string", enum: ["strength", "improve"] },
    scope,
  },
};
const momentItem = {
  type: "object",
  additionalProperties: false,
  required: [
    "eventId",
    "title",
    "whatHappened",
    "whatToDoInstead",
    "kind",
    "scope",
  ],
  properties: {
    eventId: string,
    title: string,
    whatHappened: string,
    whatToDoInstead: string,
    kind: { type: "string", enum: ["mistake", "highlight"] },
    scope,
  },
};
const drillItem = {
  type: "object",
  additionalProperties: false,
  required: ["name", "durationMinutes", "howTo", "metric", "scope"],
  properties: {
    name: string,
    durationMinutes: { type: "integer" },
    howTo: string,
    metric: string,
    scope,
  },
};
const DRILL_AREAS = [
  "utility",
  "crosshair",
  "positioning",
  "aim",
  "trading",
  "economy",
  "general",
] as const;
const planItem = {
  type: "object",
  additionalProperties: false,
  required: ["text", "scope"],
  properties: { text: string, scope },
};
export const coachingOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "summary", "insights", "keyMoments", "drills", "plan"],
  properties: {
    verdict: string,
    summary: string,
    insights: { type: "array", maxItems: 8, items: insightItem },
    keyMoments: { type: "array", maxItems: 6, items: momentItem },
    drills: { type: "array", maxItems: 4, items: drillItem },
    plan: { type: "array", maxItems: 3, items: planItem },
  },
};
/** Deep tier output: up to 10 key moments and 6 drills tagged with a practice area. */
export const deepCoachingOutputSchema = {
  ...coachingOutputSchema,
  properties: {
    ...coachingOutputSchema.properties,
    keyMoments: { type: "array", maxItems: 10, items: momentItem },
    drills: {
      type: "array",
      maxItems: 6,
      items: {
        ...drillItem,
        required: [...drillItem.required, "area"],
        properties: {
          ...drillItem.properties,
          area: { type: "string", enum: [...DRILL_AREAS] },
        },
      },
    },
  },
};

/**
 * Compact, non-citable context from the detailed breakdowns (weapons, callouts, hit groups,
 * timing, utility, economy). Map positions are left out; callout names carry the same signal.
 */
export function detailContext(player: Analysis["players"][number]) {
  const d = player.detail;
  if (!d) return undefined;
  return {
    ...(d.shots !== undefined ? { shots: d.shots, gunHits: d.hits } : {}),
    ...(d.hitgroups ? { hitgroups: d.hitgroups } : {}),
    ...(d.weapons
      ? {
          weapons: d.weapons.slice(0, 8).map((w) => ({
            weapon: w.weapon,
            kills: w.kills,
            headshots: w.headshots,
            damage: w.damage,
            shots: w.shots,
            hits: w.hits,
            ...(w.evidenceId ? { evidenceId: w.evidenceId } : {}),
          })),
        }
      : {}),
    ...(d.places
      ? {
          callouts: d.places.slice(0, 10).map((p) => ({
            place: p.place,
            kills: p.kills,
            deaths: p.deaths,
            damage: p.damage,
            ...(p.evidenceId ? { evidenceId: p.evidenceId } : {}),
          })),
        }
      : {}),
    ...(d.timing ? { timing: d.timing } : {}),
    ...(d.avgKillDistance !== undefined
      ? { avgKillDistanceMeters: d.avgKillDistance }
      : {}),
    ...(d.utility ? { utility: d.utility } : {}),
    ...(d.economy ? { economy: d.economy } : {}),
  };
}

/** Facts the model may cite: evidence entries (with values) for one player or the whole match. */
function factsFor(analysis: Analysis, focus?: Analysis["players"][number]) {
  const ids = focus
    ? new Set(
        [
          focus.kills,
          focus.deaths,
          focus.adr,
          focus.headshotPercentage,
          ...Object.values(focus.advanced ?? {}),
        ]
          .flatMap((m) => m.evidenceIds)
          .concat(focus.detail?.evidenceIds ?? []),
      )
    : undefined;
  return analysis.evidence
    .filter((e) => e.value !== undefined && (!ids || ids.has(e.id)))
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      value: e.value,
      description: e.description,
    }));
}

export type AiCoachingResult = {
  coaching: Coaching;
  call: Omit<ModelResult, "data">;
};

/**
 * Asks the configured model for a review. Always performs a real provider call; it never
 * substitutes deterministic output. Insights citing evidence outside the supplied facts are
 * removed and reported in caveats.
 */
export async function aiCoaching(
  input: unknown,
  config: AiConfig,
  options: Omit<CoachingOptions, "ai"> = {},
): Promise<AiCoachingResult> {
  const parsed = analysisSchema.parse(input);
  const tier = options.tier ?? "quick";
  if (tier === "deep" && (!options.deep || !options.focusSteamId))
    throw new Error("A deep review needs the deep modules of one player");
  const deep = tier === "deep" ? options.deep : undefined;
  // Deep facts become citable evidence of this review (validated like any other fact).
  const analysis = deep
    ? { ...parsed, evidence: [...parsed.evidence, ...deep.evidence] }
    : parsed;
  const focus = options.focusSteamId
    ? analysis.players.find((p) => p.steamId === options.focusSteamId)
    : undefined;
  if (options.focusSteamId && !focus) throw new Error("Unknown player");
  const facts = [
    ...factsFor(parsed, focus),
    ...(deep?.evidence ?? []).map((e) => ({
      id: e.id,
      kind: e.kind,
      value: e.value,
      description: e.description,
    })),
  ];
  if (!facts.length)
    throw new AiError(
      "invalid_output",
      "No complete evidence is available to send to the model.",
    );
  const lang = options.lang ?? "en";
  const perMap = options.personal?.perMapLearning ?? true;
  const history = historyForMap(
    options.personal?.history,
    analysis.map,
    perMap,
  );
  const plans = plansForMap(
    options.personal?.previousPlans,
    analysis.map,
    perMap,
  );
  const candidates = focus ? momentCandidates(analysis, focus.steamId) : [];
  // Player names are deliberately never sent (prompt-injection isolation).
  const payload = {
    map: analysis.map ?? null,
    rounds: analysis.roundOutcomes?.length ?? null,
    facts,
    caveats: analysis.caveats,
    ...(focus
      ? {
          player: "the player being coached (refer to them as 'you')",
          matchContext: matchAverages(analysis),
          ...(focus.detail ? { detail: detailContext(focus) } : {}),
          perRound: (focus.rounds ?? []).map((r) => ({
            ...r,
            killedBy: undefined,
          })),
          ...(history ? { playerHistory: history } : {}),
          ...(plans.general.length || plans.thisMap.length
            ? { previousPlans: plans }
            : {}),
          momentCandidates: candidates,
          ...(deep ? { deep: deepContext(deep.deep) } : {}),
          ruleFindings: playerInsights(analysis, focus.steamId).map((i) => ({
            observation: i.observation,
            evidenceIds: i.evidenceIds,
            kind: i.kind,
          })),
        }
      : {}),
  };
  const call = await callModel(
    config,
    {
      system:
        languageReminder(lang) +
        "\n\n" +
        (deep ? DEEP_SYSTEM_PROMPT : POST_MATCH_SYSTEM_PROMPT) +
        (options.personal
          ? personalizationPrompt(options.personal.preferences)
          : "") +
        languageInstruction(lang),
      user: languageReminder(lang) + "\nDATA:\n" + JSON.stringify(payload),
      schemaName: deep ? "cs2_deep_coaching" : "cs2_coaching",
      schema: deep ? deepCoachingOutputSchema : coachingOutputSchema,
    },
    options.fetch,
  );
  const coaching = validateCoaching(
    buildReview(call.data, analysis, {
      focusSteamId: focus?.steamId,
      lang,
      candidateIds: candidates,
      allowedFacts: new Set(facts.map((f) => f.id)),
      model: call.model,
      tier,
      ...(deep ? { deep: deep.deep } : {}),
    }),
    analysis,
  );
  const rawInsights = (call.data as { insights?: unknown }).insights;
  if (
    !coaching.insights.length &&
    Array.isArray(rawInsights) &&
    rawInsights.length
  )
    throw new AiError(
      "invalid_output",
      "The model's answer cited no valid evidence.",
    );
  const meta: Partial<ModelResult> = { ...call };
  delete meta.data;
  return { coaching, call: meta as Omit<ModelResult, "data"> };
}

const text = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
const obj = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

/**
 * Turns the model's raw JSON into a contract-valid review. Tolerates omitted optional parts
 * and the v4 shape (plan as strings). Drops insights citing unknown facts and key moments
 * whose eventId is not a supplied candidate, attaches deterministic clips and scores, and
 * scopes items: anything citing places/positions is "map"; "map" items carry the map.
 */
export function buildReview(
  data: unknown,
  analysis: Analysis,
  options: {
    focusSteamId?: string;
    lang: CoachLang;
    candidateIds: ReturnType<typeof momentCandidates>;
    allowedFacts: Set<string>;
    model?: string;
    tier?: "quick" | "deep";
    deep?: DeepResult["deep"];
  },
): Coaching {
  const tier = options.tier ?? "quick";
  const limits = TIER_LIMITS[tier];
  const raw = obj(data);
  const map = analysis.map ? analysis.map.slice(0, 64) : undefined;
  const scoped = (scope: "map" | "general") =>
    scope === "map" && map ? { scope, map } : { scope };
  const kinds = new Map(analysis.evidence.map((e) => [e.id, e.kind]));
  const insights = Array.isArray(raw.insights) ? raw.insights.map(obj) : [];
  const valid = insights.filter(
    (i) =>
      Array.isArray(i.evidenceIds) &&
      i.evidenceIds.length > 0 &&
      i.evidenceIds.every(
        (id) => typeof id === "string" && options.allowedFacts.has(id),
      ) &&
      text(i.observation, 2000) &&
      text(i.actionablePractice, 2000),
  );
  const dropped = insights.length - valid.length;
  const focus = options.focusSteamId;
  const outInsights = valid.slice(0, 8).map((i) => {
    const ids = (i.evidenceIds as string[]).slice(0, 20);
    const kind: "strength" | "improve" | undefined =
      i.kind === "strength" || i.kind === "improve" ? i.kind : undefined;
    const mapEvidence = ids.some((id) => isMapEvidence(kinds.get(id) ?? ""));
    const clips = focus ? insightClips(analysis, ids, focus, kind) : [];
    return {
      observation: text(i.observation, 2000)!,
      evidenceIds: ids,
      confidence: (["low", "medium", "high"] as const).includes(
        i.confidence as "low",
      )
        ? (i.confidence as "low" | "medium" | "high")
        : "low",
      actionablePractice: text(i.actionablePractice, 2000)!,
      caveats: (Array.isArray(i.caveats) ? i.caveats : [])
        .map((c) => text(c, 1000))
        .filter((c): c is string => !!c)
        .slice(0, 5),
      ...(kind ? { kind } : {}),
      scope: mapEvidence ? "map" : normalizeScope(i.scope, "general"),
      ...(clips.length ? { clips } : {}),
    };
  });
  const byCandidate = new Map(options.candidateIds.map((c) => [c.id, c]));
  const used = new Set<string>();
  const keyMoments = focus
    ? (Array.isArray(raw.keyMoments) ? raw.keyMoments.map(obj) : [])
        .filter((m) => {
          const c =
            typeof m.eventId === "string"
              ? byCandidate.get(m.eventId)
              : undefined;
          if (!c || used.has(c.id)) return false;
          // A moment whose text names another round describes something else: drop it.
          const rounds = [
            ...`${m.title} ${m.whatHappened}`.matchAll(
              /\b(?:round|rodada)\s+(\d{1,4})\b/gi,
            ),
          ].map((x) => Number(x[1]));
          if (rounds.some((r) => r !== c.round)) return false;
          // A moment whose text inverts its event (the player's kill told as "you die") is wrong.
          if (contradictsOutcome(`${m.title} ${m.whatHappened}`, c.kind))
            return false;
          used.add(c.id);
          return (
            !!text(m.title, 120) &&
            !!text(m.whatHappened, 600) &&
            !!text(m.whatToDoInstead, 600)
          );
        })
        .slice(0, limits.keyMoments)
        .map((m) => {
          const c = byCandidate.get(m.eventId as string)!;
          return {
            eventId: c.id,
            round: c.round,
            time: c.time,
            title: text(m.title, 120)!,
            whatHappened: text(m.whatHappened, 600)!,
            whatToDoInstead: text(m.whatToDoInstead, 600)!,
            // The event decides the kind; the model's label is not trusted.
            kind: momentKind(c.kind),
            scope: normalizeScope(
              m.scope,
              c.yourPlace || c.enemyPlace ? "map" : "general",
            ),
            clip: momentClip(analysis, c, focus),
          };
        })
    : [];
  const drills = (Array.isArray(raw.drills) ? raw.drills.map(obj) : [])
    .filter(
      (d) => text(d.name, 120) && text(d.howTo, 800) && text(d.metric, 300),
    )
    .slice(0, limits.drills)
    .map((d) => {
      const minutes = Number(d.durationMinutes);
      const area = DRILL_AREAS.find((a) => a === d.area);
      return {
        name: text(d.name, 120)!,
        durationMinutes: Number.isFinite(minutes)
          ? Math.max(1, Math.min(120, Math.round(minutes)))
          : 15,
        howTo: text(d.howTo, 800)!,
        metric: text(d.metric, 300)!,
        ...scoped(normalizeScope(d.scope, "general")),
        ...(tier === "deep" && area ? { area } : {}),
      };
    });
  const planItems = (Array.isArray(raw.plan) ? raw.plan : [])
    .map((p) =>
      typeof p === "string"
        ? { text: text(p, 300), scope: "general" as const }
        : {
            text: text(obj(p).text, 300),
            scope: normalizeScope(obj(p).scope, "general"),
          },
    )
    .filter((p): p is { text: string; scope: "map" | "general" } => !!p.text)
    .slice(0, 3)
    .map((p) => ({ text: p.text, ...scoped(p.scope) }));
  const scores = focus ? playerScores(analysis, focus) : undefined;
  const verdict = text(raw.verdict, 90);
  const summary = text(raw.summary, 2000);
  return {
    schemaVersion: "1.0",
    mode: "provider",
    tier,
    ...(map ? { map } : {}),
    provenance: {
      promptVersion:
        tier === "deep" ? DEEP_PROMPT_VERSION : POST_MATCH_PROMPT_VERSION,
      ...(options.model ? { model: options.model } : {}),
    },
    ...(verdict ? { verdict } : {}),
    ...(summary ? { summary } : {}),
    insights: outInsights,
    ...(Array.isArray(raw.plan)
      ? { plan: planItems.map((p) => p.text), planItems }
      : {}),
    ...(scores ? { scores } : {}),
    ...(keyMoments.length ? { keyMoments } : {}),
    ...(drills.length ? { drills } : {}),
    ...(options.deep ? { deep: options.deep } : {}),
    caveats: [
      ...analysis.caveats,
      ...(dropped
        ? [
            options.lang === "pt"
              ? `${dropped} ponto(s) da IA foram removidos por citarem evidências inexistentes.`
              : `${dropped} AI point(s) were removed because they cited evidence that does not exist.`,
          ]
        : []),
    ],
  };
}

/** Deterministic feedback, or a real model review when `ai` is configured. */
export async function generateCoaching(
  input: unknown,
  options: CoachingOptions = {},
): Promise<Coaching> {
  const analysis = analysisSchema.parse(input);
  if (options.ai)
    return (await aiCoaching(analysis, options.ai, options)).coaching;
  if (!options.focusSteamId) return offlineCoaching(analysis);
  if (!analysis.players.some((p) => p.steamId === options.focusSteamId))
    throw new Error("Unknown player");
  const scores = playerScores(analysis, options.focusSteamId);
  return validateCoaching(
    {
      ...offlinePlayerCoaching(analysis, options.focusSteamId, options.lang),
      ...(analysis.map ? { map: analysis.map.slice(0, 64) } : {}),
      ...(scores ? { scores } : {}),
    },
    analysis,
  );
}
