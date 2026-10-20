/**
 * Applies the claim checks and the verifier (verify.ts) to a quick/deep review: insight
 * observations, key-moment descriptions, verdict, summary and plan items are claims. A dropped
 * observation or key moment removes the item; a dropped verdict/summary/plan item removes that
 * text. Verification statistics are recorded in the review's provenance.
 */
import { clipText } from "./clip-text.js";
import type { CoachLang } from "./languages.js";
import type { Analysis, Coaching } from "@cs2/contracts";
import type { ClaimContext } from "./claims.js";
import type { MomentCandidate } from "./review.js";
import type { AiConfig } from "./provider.js";
import {
  verifyClaims,
  type VerifiableClaim,
  type VerificationResult,
} from "./verify.js";
import type { SampledFact } from "./confidence.js";

export type VerifyOptions = {
  /** Verifier model; absent = only the deterministic checks run. */
  config?: AiConfig;
  fetch?: typeof fetch;
};

export function claimContext(
  analysis: Analysis,
  facts: SampledFact[],
  extra: Analysis["evidence"] = [],
): ClaimContext {
  const evidence = new Map(
    [...analysis.evidence, ...extra].map((e) => [e.id, e]),
  );
  return {
    facts: new Map(
      facts.map((f) => [
        f.id,
        {
          ...(f.value !== undefined ? { value: f.value } : {}),
          n: f.n,
          description: f.description,
          eventIds: evidence.get(f.id)?.eventIds ?? [],
        },
      ]),
    ),
    eventRounds: new Map((analysis.events ?? []).map((e) => [e.id, e.round])),
    totalRounds:
      analysis.roundOutcomes?.length ||
      Math.max(0, ...analysis.players.map((p) => p.rounds?.length ?? 0)),
  };
}

const factView = (facts: SampledFact[]) =>
  new Map(
    facts.map((f) => [
      f.id,
      {
        id: f.id,
        kind: f.kind,
        value: f.value,
        n: f.n,
        confidence: f.confidence,
        description: f.description,
      } as Record<string, unknown>,
    ]),
  );

const momentNumbers = (c: MomentCandidate) => [
  c.time,
  c.round,
  ...(c.yourHpBefore !== undefined ? [c.yourHpBefore] : []),
  ...(c.distanceMeters !== undefined ? [c.distanceMeters] : []),
];

/** Verifies a built review in place-safe fashion (returns a new object). */
export async function verifyCoaching(
  coaching: Coaching,
  ctx: ClaimContext,
  facts: SampledFact[],
  candidates: MomentCandidate[],
  lang: CoachLang,
  options: VerifyOptions,
): Promise<{ coaching: Coaching; result: VerificationResult }> {
  const cited = [...new Set(coaching.insights.flatMap((i) => i.evidenceIds))];
  const scope = cited.length ? cited : facts.map((f) => f.id);
  const byCandidate = new Map(candidates.map((c) => [c.id, c]));
  const claims: VerifiableClaim[] = [
    ...coaching.insights.map((i, n) => ({
      key: `insight:${n}`,
      text: i.observation,
      factIds: i.evidenceIds,
    })),
    ...(coaching.keyMoments ?? []).map((m, n) => {
      const c = byCandidate.get(m.eventId);
      return {
        key: `moment:${n}`,
        text: m.whatHappened,
        factIds: [],
        eventIds: [m.eventId],
        extraRounds: [m.round],
        extraNumbers: c ? momentNumbers(c) : [m.time],
        ...(c ? { context: { event: { ...c, id: undefined } } } : {}),
      };
    }),
    ...(coaching.verdict
      ? [{ key: "verdict", text: coaching.verdict, factIds: scope }]
      : []),
    ...(coaching.summary
      ? [{ key: "summary", text: coaching.summary, factIds: scope }]
      : []),
    ...(coaching.planItems ?? []).map((p, n) => ({
      key: `plan:${n}`,
      text: p.text,
      factIds: scope,
    })),
  ];
  const result = await verifyClaims(claims, ctx, {
    lang,
    factView: factView(facts),
    ...(options.config ? { config: options.config } : {}),
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  const out = result.outcomes;
  const textOf = (key: string, original: string): string | undefined => {
    const o = out.get(key);
    if (!o || o.action === "keep") return original;
    return o.action === "replace" ? o.text : undefined;
  };
  const insights = coaching.insights.flatMap((i, n) => {
    const observation = textOf(`insight:${n}`, i.observation);
    return observation
      ? [{ ...i, observation: clipText(observation, 2000) }]
      : [];
  });
  const keyMoments = (coaching.keyMoments ?? []).flatMap((m, n) => {
    const whatHappened = textOf(`moment:${n}`, m.whatHappened);
    return whatHappened
      ? [{ ...m, whatHappened: clipText(whatHappened, 600) }]
      : [];
  });
  const planItems = (coaching.planItems ?? []).flatMap((p, n) => {
    const text = textOf(`plan:${n}`, p.text);
    return text ? [{ ...p, text: clipText(text, 300) }] : [];
  });
  const verdict = coaching.verdict
    ? clipOpt(textOf("verdict", coaching.verdict), 90)
    : undefined;
  const summary = coaching.summary
    ? clipOpt(textOf("summary", coaching.summary), 2000)
    : undefined;
  const next: Coaching = {
    ...coaching,
    insights,
    provenance: {
      promptVersion: coaching.provenance?.promptVersion ?? "unknown",
      ...coaching.provenance,
      verification: result.stats,
    },
    caveats: [...coaching.caveats, ...result.caveats],
  };
  delete next.verdict;
  delete next.summary;
  if (verdict) next.verdict = verdict;
  if (summary) next.summary = summary;
  if (coaching.keyMoments) {
    delete next.keyMoments;
    if (keyMoments.length) next.keyMoments = keyMoments;
  }
  if (coaching.planItems) {
    next.planItems = planItems;
    next.plan = planItems.map((p) => p.text);
  }
  return { coaching: next, result };
}

const clipOpt = (t: string | undefined, max: number) =>
  t === undefined ? undefined : clipText(t, max);
