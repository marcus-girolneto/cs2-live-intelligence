/**
 * Team review: deterministic team facts → one model call (purpose review_team, prompt
 * igl-team-v5, aliases only) → output guard → validation (fact ids, candidate rounds, aliases
 * mapped back to Steam ids server-side, confidence capped by the cited facts) → claim checks
 * and the optional verifier.
 */
import type { CoachLang } from "../languages.js";
import {
  analysisSchema,
  teamReviewSchema,
  type Analysis,
  type Clip,
  type TeamFact,
  type TeamReview,
} from "@cs2/contracts";
import { enforceConfidence } from "../confidence.js";
import {
  fairAnalysis,
  flaggedOpponents,
  UNUSUAL_OPPONENT_CAVEAT,
} from "../integrity.js";
import { planTarget } from "../plan-metrics.js";
import { languageInstruction, languageReminder } from "../prompts.js";
import { secureModelCall } from "../prompt-kit.js";
import { AiError, type AiConfig, type ModelResult } from "../provider.js";
import { clipsFor, normalizeScope } from "../review.js";
import type { GuardSpec } from "../security.js";
import {
  variantPrompt,
  variantVersion,
  type PromptVariant,
} from "../variants.js";
import { verifyClaims, type VerifiableClaim } from "../verify.js";
import {
  analyzeTeam,
  type RoundCandidate,
  type TeamAnalysis,
} from "./facts.js";
import { nameTeamReview } from "./names.js";
import { timeOf } from "./roster.js";
import {
  TEAM_OUTPUT_SCHEMA,
  TEAM_PROMPT_VERSION,
  TEAM_SYSTEM_PROMPT,
} from "./prompt.js";

export const TEAM_GUARD: GuardSpec = {
  fields: ["verdict"],
  lists: ["caveats"],
  critical: ["verdict"],
  items: {
    roles: {
      items: {
        strengths: { fields: ["text"] },
        fixes: { fields: ["text"] },
      },
    },
    patterns: { fields: ["text"] },
    keyRounds: { fields: ["title", "whatHappened", "whatToDoInstead"] },
    plan: { fields: ["text"] },
  },
};

export type TeamReviewOptions = {
  steamId: string;
  lang?: CoachLang;
  /** analysis.integrity of the stored document (deaths to unusual opponents are excluded). */
  integrity?: unknown;
  /** Claim checks (+ verifier model when `config` is set); absent = not verified. */
  verify?: { config?: AiConfig; fetch?: typeof fetch };
  variant?: PromptVariant;
  fetch?: typeof fetch;
};
export type AiTeamResult = {
  review: TeamReview;
  call: Omit<ModelResult, "data">;
};

const text = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
const obj = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const list = (v: unknown) => (Array.isArray(v) ? v.map(obj) : []);

/** The model-facing payload (aliases only; no names, no Steam ids). */
export function teamPayload(
  t: TeamAnalysis,
  analysis: Analysis,
  excluded: number,
) {
  const al = (id: string) => t.roster.alias.get(id)!;
  return {
    map: analysis.map ?? null,
    rounds: t.views.length,
    team: t.roster.members.map((id) => ({
      alias: al(id),
      role: t.roles.get(id),
    })),
    teamScores: Object.fromEntries(
      Object.entries(t.scores).map(([k, s]) => [
        k,
        { value: s!.value, basis: s!.basis },
      ]),
    ),
    facts: t.facts.map((f) => ({
      id: f.id,
      kind: f.kind,
      ...(f.steamId ? { about: al(f.steamId) } : {}),
      value: f.value,
      n: f.n,
      confidence: f.confidence,
      description: f.description,
    })),
    roundCandidates: t.candidates.map((c) => ({ ...c, eventIds: undefined })),
    ...(excluded ? { deathsNotCounted: excluded } : {}),
  };
}

/** Clips around a fact's timed kills (focus: the team member involved). */
function factClips(
  analysis: Analysis,
  t: TeamAnalysis,
  factIds: string[],
): Clip[] {
  const byId = new Map((analysis.events ?? []).map((e) => [e.id, e]));
  const events = factIds
    .flatMap((id) => t.facts.find((f) => f.id === id)?.eventIds ?? [])
    .map((id) => byId.get(id))
    .filter(
      (
        e,
      ): e is Extract<NonNullable<typeof e>, { type: "kill" }> & {
        roundTime: number;
      } => !!e && e.type === "kill" && typeof e.roundTime === "number",
    );
  if (!events.length) return [];
  const focus = (e: (typeof events)[number]) =>
    t.roster.members.includes(e.victimId)
      ? e.victimId
      : (e.attackerId ?? t.roster.members[0]!);
  return clipsFor(analysis, events.slice(0, 12), focus(events[0]!), 3).map(
    (c) => ({
      ...c,
      focusSteamId: focus(
        events.find((e) => e.round === c.round) ?? events[0]!,
      ),
    }),
  );
}

function roundClip(
  analysis: Analysis,
  t: TeamAnalysis,
  c: RoundCandidate,
): Clip | undefined {
  const view = t.views.find((v) => v.round === c.round);
  const first = view?.kills.find((k) => typeof k.roundTime === "number");
  if (!view || !first) return undefined;
  const focus = t.roster.members.includes(first.victimId)
    ? first.victimId
    : (first.attackerId ?? t.roster.members[0]!);
  const timed = view.kills.filter(
    (k): k is typeof k & { roundTime: number } =>
      typeof k.roundTime === "number",
  );
  const [clip] = clipsFor(analysis, timed.slice(0, 1), focus, 1);
  if (!clip) return undefined;
  const last = timed.at(-1)!;
  return {
    ...clip,
    to: Math.max(clip.to, Math.round((timeOf(last) + 2) * 100) / 100),
  };
}

/** Raw model answer → contract team review (before claim verification). */
export function buildTeamReview(
  data: unknown,
  analysis: Analysis,
  t: TeamAnalysis,
  lang: CoachLang,
): TeamReview {
  const raw = obj(data);
  const facts = new Map(t.facts.map((f) => [f.id, f]));
  const fromAlias = new Map([...t.roster.alias].map(([id, a]) => [a, id]));
  const valid = (ids: unknown) =>
    Array.isArray(ids) &&
    ids.length > 0 &&
    ids.every((id) => typeof id === "string" && facts.has(id));
  let dropped = 0;
  const points = (v: unknown) =>
    list(v)
      .filter((p) => {
        const ok = valid(p.evidenceIds) && !!text(p.text, 300);
        if (!ok) dropped++;
        return ok;
      })
      .slice(0, 3)
      .map((p) => ({
        text: text(p.text, 300)!,
        evidenceIds: (p.evidenceIds as string[]).slice(0, 12),
      }));
  const modelRoles = new Map(list(raw.roles).map((r) => [String(r.alias), r]));
  const roles = t.roster.members.map((id) => {
    const r = modelRoles.get(t.roster.alias.get(id)!) ?? {};
    return {
      steamId: id,
      role: t.roles.get(id) ?? ("flex" as const),
      strengths: points(r.strengths),
      fixes: points(r.fixes),
    };
  });
  const map = analysis.map ? analysis.map.slice(0, 64) : undefined;
  const patterns = enforceConfidence(
    list(raw.patterns)
      .filter((p) => {
        const ok = valid(p.evidenceIds) && !!text(p.text, 400);
        if (!ok) dropped++;
        return ok;
      })
      .slice(0, 8)
      .map((p) => {
        const ids = (p.evidenceIds as string[]).slice(0, 12);
        const scope = normalizeScope(p.scope, "general");
        return {
          scope,
          ...(scope === "map" && map ? { map } : {}),
          text: text(p.text, 400)!,
          evidenceIds: ids,
          confidence: (["low", "medium", "high"] as const).includes(
            p.confidence as "low",
          )
            ? (p.confidence as "low" | "medium" | "high")
            : ("low" as const),
          clips: factClips(analysis, t, ids),
        };
      }),
    facts,
  );
  const byRound = new Map(t.candidates.map((c) => [c.round, c]));
  const used = new Set<number>();
  const keyRounds = list(raw.keyRounds)
    .filter((k) => {
      const c = byRound.get(Number(k.round));
      if (!c || used.has(c.round)) return false;
      const named = [
        ...`${k.title} ${k.whatHappened}`.matchAll(
          /\b(?:round|rodada)\s+(\d{1,4})\b/gi,
        ),
      ].map((x) => Number(x[1]));
      if (named.some((r) => r !== c.round)) return false;
      used.add(c.round);
      return (
        !!text(k.title, 120) &&
        !!text(k.whatHappened, 600) &&
        !!text(k.whatToDoInstead, 600)
      );
    })
    .slice(0, 8)
    .map((k) => {
      const c = byRound.get(Number(k.round))!;
      const clip = roundClip(analysis, t, c);
      return {
        round: c.round,
        title: text(k.title, 120)!,
        whatHappened: text(k.whatHappened, 600)!,
        whatToDoInstead: text(k.whatToDoInstead, 600)!,
        eventIds: c.eventIds.slice(0, 20),
        ...(clip ? { clip } : {}),
      };
    });
  const plan = list(raw.plan)
    .filter((p) => !!text(p.text, 300))
    .slice(0, 5)
    .map((p) => {
      const owner = fromAlias.get(String(p.owner)) ?? "team";
      return {
        text: text(p.text, 300)!,
        owner,
        ...planTarget(text(p.text, 300)!, p.targetMetric, p.direction),
      };
    });
  const caveats = (Array.isArray(raw.caveats) ? raw.caveats : [])
    .map((c) => text(c, 1000))
    .filter((c): c is string => !!c)
    .slice(0, 3);
  if (dropped)
    caveats.push(
      lang === "pt"
        ? `${dropped} ponto(s) da IA foram removidos por citarem evidências inexistentes.`
        : `${dropped} AI point(s) were removed because they cited evidence that does not exist.`,
    );
  return {
    schemaVersion: "1.0",
    ...(map ? { map } : {}),
    members: t.roster.members,
    verdict: text(raw.verdict, 120) ?? "",
    teamScores: t.scores,
    roles,
    patterns,
    keyRounds,
    plan,
    facts: t.facts.slice(0, 200),
    caveats,
  };
}

/** Claims of a team review for the checks / verifier, and how to apply the outcomes. */
async function verifyTeam(
  review: TeamReview,
  analysis: Analysis,
  t: TeamAnalysis,
  lang: CoachLang,
  options: NonNullable<TeamReviewOptions["verify"]>,
): Promise<TeamReview> {
  const cited = [
    ...new Set([
      ...review.patterns.flatMap((p) => p.evidenceIds),
      ...review.roles.flatMap((r) =>
        [...r.strengths, ...r.fixes].flatMap((p) => p.evidenceIds),
      ),
    ]),
  ];
  const scope = cited.length ? cited : t.facts.map((f) => f.id);
  const byRound = new Map(t.candidates.map((c) => [c.round, c]));
  const claims: VerifiableClaim[] = [
    ...review.patterns.map((p, i) => ({
      key: `pattern:${i}`,
      text: p.text,
      factIds: p.evidenceIds,
    })),
    ...review.roles.flatMap((r, i) => [
      ...r.strengths.map((p, j) => ({
        key: `role:${i}:s:${j}`,
        text: p.text,
        factIds: p.evidenceIds,
      })),
      ...r.fixes.map((p, j) => ({
        key: `role:${i}:f:${j}`,
        text: p.text,
        factIds: p.evidenceIds,
      })),
    ]),
    ...review.keyRounds.map((k, i) => {
      const c = byRound.get(k.round);
      const situation = c?.situation?.split("v").map(Number) ?? [];
      return {
        key: `round:${i}`,
        text: k.whatHappened,
        factIds: [],
        eventIds: k.eventIds,
        extraRounds: [k.round],
        extraNumbers: [...situation, ...(c?.kills.map((x) => x.time) ?? [])],
        ...(c ? { context: { round: { ...c, eventIds: undefined } } } : {}),
      };
    }),
    ...(review.verdict
      ? [{ key: "verdict", text: review.verdict, factIds: scope }]
      : []),
    ...review.plan.map((p, i) => ({
      key: `plan:${i}`,
      text: p.text,
      factIds: scope,
    })),
  ];
  const view = new Map(
    t.facts.map((f) => [
      f.id,
      {
        kind: f.kind,
        value: f.value,
        n: f.n,
        confidence: f.confidence,
        description: f.description,
      } as Record<string, unknown>,
    ]),
  );
  const result = await verifyClaims(
    claims,
    {
      facts: new Map(
        t.facts.map((f: TeamFact) => [
          f.id,
          {
            value: f.value,
            n: f.n,
            description: f.description,
            eventIds: f.eventIds,
          },
        ]),
      ),
      eventRounds: new Map((analysis.events ?? []).map((e) => [e.id, e.round])),
      totalRounds: t.views.length,
    },
    {
      lang,
      factView: view,
      ...(options.config ? { config: options.config } : {}),
      ...(options.fetch ? { fetch: options.fetch } : {}),
    },
  );
  const pick = (key: string, original: string) => {
    const o = result.outcomes.get(key);
    return !o || o.action === "keep"
      ? original
      : o.action === "replace"
        ? o.text
        : undefined;
  };
  const roles = review.roles.map((r, i) => ({
    ...r,
    strengths: r.strengths.flatMap((p, j) => {
      const tx = pick(`role:${i}:s:${j}`, p.text);
      return tx ? [{ ...p, text: tx.slice(0, 300) }] : [];
    }),
    fixes: r.fixes.flatMap((p, j) => {
      const tx = pick(`role:${i}:f:${j}`, p.text);
      return tx ? [{ ...p, text: tx.slice(0, 300) }] : [];
    }),
  }));
  return {
    ...review,
    verdict: (pick("verdict", review.verdict) ?? "").slice(0, 120),
    roles,
    patterns: review.patterns.flatMap((p, i) => {
      const tx = pick(`pattern:${i}`, p.text);
      return tx ? [{ ...p, text: tx.slice(0, 400) }] : [];
    }),
    keyRounds: review.keyRounds.flatMap((k, i) => {
      const tx = pick(`round:${i}`, k.whatHappened);
      return tx ? [{ ...k, whatHappened: tx.slice(0, 600) }] : [];
    }),
    plan: review.plan.flatMap((p, i) => {
      const tx = pick(`plan:${i}`, p.text);
      return tx ? [{ ...p, text: tx.slice(0, 300) }] : [];
    }),
    provenance: { ...review.provenance!, verification: result.stats },
    caveats: [...review.caveats, ...result.caveats].slice(0, 20),
  };
}

/** One AI review of the requesting player's team. */
export async function aiTeamReview(
  input: unknown,
  config: AiConfig,
  options: TeamReviewOptions,
): Promise<AiTeamResult> {
  const parsed = analysisSchema.parse(input);
  const lang = options.lang ?? "en";
  const first = analyzeTeam(parsed, options.steamId);
  const flagged = flaggedOpponents(options.integrity);
  let analysis = parsed;
  const excluded: string[] = [];
  for (const id of first.roster.members) {
    const fair = fairAnalysis(analysis, id, flagged);
    analysis = fair.analysis;
    excluded.push(...fair.excluded);
  }
  const t = excluded.length ? analyzeTeam(analysis, options.steamId) : first;
  if (!t.facts.length)
    throw new AiError(
      "invalid_output",
      "No team facts are available to send to the model.",
    );
  const variant = options.variant ?? "a";
  const secured = await secureModelCall({
    purpose: "review_team",
    config,
    system: () =>
      languageReminder(lang) +
      "\n\n" +
      variantPrompt(TEAM_SYSTEM_PROMPT, TEAM_PROMPT_VERSION, variant) +
      languageInstruction(lang),
    reminder: languageReminder(lang),
    payload: teamPayload(t, analysis, excluded.length),
    schemaName: "cs2_team_review",
    schema: TEAM_OUTPUT_SCHEMA,
    guard: TEAM_GUARD,
    lang,
    knownIds: t.facts.map((f) => f.id),
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  let review = buildTeamReview(secured.data, analysis, t, lang);
  review.provenance = {
    promptVersion: variantVersion(TEAM_PROMPT_VERSION, variant),
    model: secured.meta.model,
    ...(options.variant ? { variant } : {}),
  };
  if (excluded.length) review.caveats.push(UNUSUAL_OPPONENT_CAVEAT[lang]);
  review.caveats.push(...secured.caveats);
  if (options.verify)
    review = await verifyTeam(review, analysis, t, lang, {
      ...options.verify,
      ...(options.verify.fetch || options.fetch
        ? { fetch: options.verify.fetch ?? options.fetch }
        : {}),
    });
  if (
    !review.verdict ||
    (!review.patterns.length &&
      !review.roles.some((r) => r.strengths.length || r.fixes.length))
  )
    throw new AiError(
      "invalid_output",
      "The model's team review cited no valid evidence.",
    );
  review.caveats = review.caveats.slice(0, 20);
  // Names go back in only now: the model, the guard and the verifier only saw aliases.
  review = nameTeamReview(review, analysis.players, lang);
  return { review: teamReviewSchema.parse(review), call: secured.meta };
}
