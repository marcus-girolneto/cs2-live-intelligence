/**
 * Second opinion on a review (purpose "verify", prompt verify-v1): a cheap model receives ONLY
 * each claim's text and the facts it cites and says per claim whether it is supported, with an
 * optional corrected text. Deterministic number/round/"consecutive" checks (claims.ts) run
 * first and always win: an unsupported or numerically wrong claim is replaced by a corrected
 * text that passes the checks, or dropped. Statistics go to the review's provenance.
 */
import type { Verification } from "@cs2/contracts";
import {
  checkClaim,
  withoutConsecutive,
  type Claim,
  type ClaimContext,
} from "./claims.js";
import {
  PRIORITY_ORDER,
  SECURITY_RULES,
  secureModelCall,
} from "./prompt-kit.js";
import type { AiConfig } from "./provider.js";
import { canaryLine, type GuardSpec } from "./security.js";
import { languageInstruction, languageReminder } from "./prompts.js";

export const VERIFY_PROMPT_VERSION = "verify-v1";

export const VERIFY_SYSTEM_PROMPT = `You are the fact checker of this app's Counter-Strike 2 coach. Another coach wrote short claims about one match; you check each claim strictly against the facts supplied with it and nothing else.

${PRIORITY_ORDER}
${SECURITY_RULES}

TASK (reason internally; output only the final JSON):
- For every entry of "claims": read its "text" and its "facts" (values, sample sizes "n", descriptions, and for single events the event details). A claim is supported only when every number, round, count, place, weapon and outcome it states is backed by those facts and its conclusion does not go beyond them.
- "consecutive", "in a row" or "seguidos" need rounds that really follow each other (e.g. 4, 5, 6). Rounds 3, 7 and 12 are not consecutive.
- Advice and recommendations ("play closer to a teammate") are fine when the observation they rest on is supported; judge the factual part.
- When a claim is not supported but a faithful version is possible, write "correctedText": the same idea, same language and similar length, stating only what the facts support (fix or remove the wrong numbers or words). Otherwise "correctedText" is an empty string.
- Do not add new advice, new facts or any id to "correctedText".

EDGE CASES:
- A claim that states no fact (pure advice): supported.
- A claim that presents a fact with confidence "low" as a firm habit: not supported; correct it to hedged wording ("early sign", "indício").
- Missing or empty facts for a claim with numbers: not supported, empty "correctedText".

OUTPUT: {"results": [{"id": the claim id, "supported": true | false, "correctedText": string}]}, one result per claim, in the same order.${canaryLine(VERIFY_PROMPT_VERSION)}`;

const VERIFY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["results"],
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "supported", "correctedText"],
        properties: {
          id: { type: "string" },
          supported: { type: "boolean" },
          correctedText: { type: "string" },
        },
      },
    },
  },
};
const VERIFY_GUARD: GuardSpec = {
  items: { results: { fields: ["correctedText"] } },
};

export type VerifiableClaim = Claim & {
  /** Event details the verifier may read for this claim (key moments / key rounds). */
  context?: Record<string, unknown>;
};
export type ClaimOutcome =
  { action: "keep" } | { action: "replace"; text: string } | { action: "drop" };
export type VerificationResult = {
  outcomes: Map<string, ClaimOutcome>;
  stats: Verification;
  caveats: string[];
};
export type VerifierOptions = {
  config?: AiConfig;
  fetch?: typeof fetch;
  lang: "en" | "pt";
  /** Fact descriptions/values the verifier may see, by id. */
  factView: Map<string, Record<string, unknown>>;
};

const CAVEATS = {
  dropped: {
    en: (n: number) =>
      `${n} statement(s) were removed because the match data did not support them.`,
    pt: (n: number) =>
      `${n} afirmação(ões) foram removidas porque os dados da partida não as sustentam.`,
  },
  corrected: {
    en: (n: number) =>
      `${n} statement(s) were corrected to match the match data.`,
    pt: (n: number) =>
      `${n} afirmação(ões) foram corrigidas para bater com os dados da partida.`,
  },
  unverified: {
    en: "The second check of this review was unavailable; only the automatic number checks ran.",
    pt: "A segunda verificação desta análise não estava disponível; só as checagens automáticas de números foram feitas.",
  },
} as const;

type ModelVerdict = { supported: boolean; correctedText: string };

async function askVerifier(
  claims: VerifiableClaim[],
  options: VerifierOptions,
): Promise<{ verdicts: Map<string, ModelVerdict>; model: string }> {
  const ids = claims.map((_, i) => `c${i + 1}`);
  const payload = {
    claims: claims.map((c, i) => ({
      id: ids[i],
      text: c.text,
      facts: [
        ...c.factIds
          .map((id) => options.factView.get(id))
          .filter((f): f is Record<string, unknown> => !!f)
          .map((f) => ({ ...f, id: undefined })),
        ...(c.context ? [c.context] : []),
      ],
    })),
  };
  const secured = await secureModelCall({
    purpose: "verify",
    config: options.config!,
    system: () =>
      languageReminder(options.lang) +
      "\n\n" +
      VERIFY_SYSTEM_PROMPT +
      languageInstruction(options.lang),
    reminder: languageReminder(options.lang),
    payload,
    schemaName: "cs2_claim_check",
    schema: VERIFY_SCHEMA,
    guard: VERIFY_GUARD,
    lang: options.lang,
    knownIds: claims.flatMap((c) => c.factIds),
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  const results = (secured.data as { results?: unknown }).results;
  const verdicts = new Map<string, ModelVerdict>();
  if (Array.isArray(results))
    for (const r of results) {
      const o = (r ?? {}) as Record<string, unknown>;
      const i = ids.indexOf(String(o.id));
      if (i < 0 || typeof o.supported !== "boolean") continue;
      verdicts.set(claims[i]!.key, {
        supported: o.supported,
        correctedText:
          typeof o.correctedText === "string" ? o.correctedText.trim() : "",
      });
    }
  return { verdicts, model: secured.meta.model };
}

/**
 * Checks every claim. Deterministic failures are fixed ("consecutive" wording removed) or need
 * a corrected text that passes the checks; the verifier's unsupported claims are replaced by
 * its corrected text when that passes the checks, otherwise dropped.
 */
export async function verifyClaims(
  claims: VerifiableClaim[],
  ctx: ClaimContext,
  options: VerifierOptions,
): Promise<VerificationResult> {
  const outcomes = new Map<string, ClaimOutcome>();
  const passes = (c: Claim, text: string) => checkClaim({ ...c, text }, ctx).ok;
  let numberFailures = 0;
  const prepared = claims.map((c) => {
    const check = checkClaim(c, ctx);
    if (check.ok) return { claim: c, ok: true, fixed: false };
    numberFailures++;
    if (check.consecutive) {
      const text = withoutConsecutive(c.text);
      if (passes(c, text))
        return { claim: { ...c, text }, ok: true, fixed: true };
    }
    return { claim: c, ok: false, fixed: false };
  });
  let verdicts: Map<string, ModelVerdict> | undefined;
  let verifierModel: string | undefined;
  const caveats: string[] = [];
  if (options.config && claims.length)
    try {
      const asked = await askVerifier(
        prepared.map((p) => p.claim),
        options,
      );
      verdicts = asked.verdicts;
      verifierModel = asked.model;
    } catch {
      caveats.push(CAVEATS.unverified[options.lang]);
    }
  let supported = 0;
  let dropped = 0;
  let corrected = 0;
  for (const p of prepared) {
    const v = verdicts?.get(p.claim.key);
    const fix =
      v?.correctedText && passes(p.claim, v.correctedText)
        ? v.correctedText
        : undefined;
    if (p.ok && (!v || v.supported)) {
      if (p.fixed) {
        corrected++;
        outcomes.set(p.claim.key, { action: "replace", text: p.claim.text });
      } else {
        supported++;
        outcomes.set(p.claim.key, { action: "keep" });
      }
    } else if (fix) {
      corrected++;
      outcomes.set(p.claim.key, { action: "replace", text: fix });
    } else {
      dropped++;
      outcomes.set(p.claim.key, { action: "drop" });
    }
  }
  if (dropped) caveats.push(CAVEATS.dropped[options.lang](dropped));
  if (corrected) caveats.push(CAVEATS.corrected[options.lang](corrected));
  return {
    outcomes,
    caveats,
    stats: {
      claims: claims.length,
      supported,
      dropped,
      corrected,
      numberFailures,
      verifier: !!verdicts,
      ...(verifierModel ? { verifierModel } : {}),
    },
  };
}
