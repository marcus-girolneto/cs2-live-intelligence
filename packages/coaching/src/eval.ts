/**
 * Offline-scored AI evaluation (nightly `pnpm eval:ai`, admin POST /v1/admin/ai/eval/run): a
 * fixed golden set of analyses goes through each review purpose with the configured providers;
 * every answer is scored for grounding (numbers matched against the cited facts, claims
 * dropped or corrected, verifier rejections), language purity, latency and cost.
 */
import { languageShare, type CoachLang } from "./languages.js";
import type { Analysis, Coaching, TeamReview } from "@cs2/contracts";
import { analysisSchema } from "@cs2/contracts";
import { checkClaim, type ClaimContext } from "./claims.js";
import { sampled } from "./confidence.js";
import { computeDeep, type DeepReplay } from "./deep/index.js";
import { aiCoaching } from "./index.js";
import type { AiConfig } from "./provider.js";
import { aiTeamReview } from "./team/index.js";

export type EvalCase = {
  name: string;
  analysis: Analysis;
  /** The coached player (default: the player with the most kills). */
  steamId?: string;
  replay?: DeepReplay;
};
export type EvalPurpose = "review_quick" | "review_deep" | "review_team";
export type EvalRun = {
  case: string;
  purpose: EvalPurpose;
  lang: CoachLang;
  ok: boolean;
  error?: string;
  model?: string;
  promptVersion?: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number | null;
  /** Numbers written in kept claims / of those, matched to cited facts. */
  numbers: number;
  numbersMatched: number;
  claims: number;
  dropped: number;
  corrected: number;
  verifierRan: boolean;
  /** Share of English stop-words in the answer (0 = all Portuguese). */
  /** Share of the answer written in the requested language (0 to 1). */
  languageShare: number | null;
  languagePure: boolean | null;
  items: number;
};
export type EvalReport = {
  createdAt: string;
  cases: string[];
  runs: EvalRun[];
  summary: {
    runs: number;
    failed: number;
    groundingRate: number | null;
    droppedClaims: number;
    correctedClaims: number;
    verifierRejectionRate: number | null;
    languagePurity: number | null;
    avgLatencyMs: number | null;
    costUsd: number | null;
    byPurpose: Record<
      string,
      {
        runs: number;
        failed: number;
        avgLatencyMs: number | null;
        groundingRate: number | null;
      }
    >;
  };
};
/** USD per million tokens, by model id (optional; cost is null without a price). */
export type Prices = Record<string, { input: number; output: number }>;

export const defaultPlayer = (a: Analysis): string =>
  [...a.players].sort((x, y) => (y.kills.value ?? 0) - (x.kills.value ?? 0))[0]!
    .steamId;

const r2 = (n: number) => Math.round(n * 100) / 100;
const mean = (v: number[]) =>
  v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;

/**
 * Number grounding of the kept fact-citing texts (insights, patterns, role points, summary)
 * against the facts they cite. Key moments/rounds are checked against their own event data
 * inside the review and are not re-scored here.
 */
function grounding(
  texts: { text: string; factIds: string[]; eventIds?: string[] }[],
  ctx: ClaimContext,
) {
  let numbers = 0;
  let matched = 0;
  for (const t of texts) {
    const total = (t.text.match(/\d+(?:[.,]\d+)?/g) ?? []).length;
    const failed = checkClaim({ key: "", ...t }, ctx).unmatched.length;
    numbers += total;
    matched += Math.max(0, total - failed);
  }
  return { numbers, matched };
}

function contextOf(
  analysis: Analysis,
  facts: {
    id: string;
    value?: number;
    n?: number;
    description?: string;
    eventIds?: string[];
  }[],
): ClaimContext {
  return {
    facts: new Map(facts.map((f) => [f.id, f])),
    eventRounds: new Map((analysis.events ?? []).map((e) => [e.id, e.round])),
    totalRounds: analysis.roundOutcomes?.length,
  };
}

function coachingTexts(c: Coaching) {
  const all = c.insights.flatMap((i) => i.evidenceIds);
  return [
    ...c.insights.map((i) => ({ text: i.observation, factIds: i.evidenceIds })),
    ...(c.summary ? [{ text: c.summary, factIds: all }] : []),
  ];
}
function teamTexts(t: TeamReview) {
  return [
    ...t.patterns.map((p) => ({ text: p.text, factIds: p.evidenceIds })),
    ...t.roles.flatMap((r) =>
      [...r.strengths, ...r.fixes].map((p) => ({
        text: p.text,
        factIds: p.evidenceIds,
      })),
    ),
  ];
}
function language(texts: string[], lang: CoachLang) {
  const share = languageShare(texts.join(" "), lang);
  return {
    languageShare: share === null ? null : r2(share),
    languagePure: share === null ? null : share >= 0.8,
  };
}

export type EvalOptions = {
  configs: Partial<Record<EvalPurpose, AiConfig>>;
  verifier?: AiConfig;
  langs?: CoachLang[];
  prices?: Prices;
  fetch?: typeof fetch;
  now?: () => Date;
};

/** Runs every case through every configured purpose (sequentially, to keep costs visible). */
export async function runEval(
  cases: EvalCase[],
  options: EvalOptions,
): Promise<EvalReport> {
  const runs: EvalRun[] = [];
  const langs = options.langs ?? ["pt"];
  for (const c of cases) {
    const analysis = analysisSchema.parse(c.analysis);
    const steamId = c.steamId ?? defaultPlayer(analysis);
    for (const purpose of [
      "review_quick",
      "review_deep",
      "review_team",
    ] as const) {
      const config = options.configs[purpose];
      if (!config) continue;
      for (const lang of langs)
        runs.push(
          await runOne(
            c.name,
            analysis,
            steamId,
            c.replay,
            purpose,
            lang,
            config,
            options,
          ),
        );
    }
  }
  return {
    createdAt: (options.now?.() ?? new Date()).toISOString(),
    cases: cases.map((c) => c.name),
    runs,
    summary: summarize(runs),
  };
}

async function runOne(
  name: string,
  analysis: Analysis,
  steamId: string,
  replay: DeepReplay | undefined,
  purpose: EvalPurpose,
  lang: CoachLang,
  config: AiConfig,
  options: EvalOptions,
): Promise<EvalRun> {
  const base = {
    case: name,
    purpose,
    lang,
    numbers: 0,
    numbersMatched: 0,
    claims: 0,
    dropped: 0,
    corrected: 0,
    verifierRan: false,
    languageShare: null,
    languagePure: null,
    items: 0,
  };
  const verify = {
    ...(options.verifier ? { config: options.verifier } : {}),
    ...(options.fetch ? { fetch: options.fetch } : {}),
  };
  try {
    if (purpose === "review_team") {
      const r = await aiTeamReview(analysis, config, {
        steamId,
        lang,
        verify,
        ...(options.fetch ? { fetch: options.fetch } : {}),
      });
      const texts = teamTexts(r.review);
      const g = grounding(texts, contextOf(analysis, r.review.facts));
      const v = r.review.provenance?.verification;
      return {
        ...base,
        ok: true,
        ...meta(r.call, r.review.provenance?.promptVersion, options.prices),
        numbers: g.numbers,
        numbersMatched: g.matched,
        claims: v?.claims ?? 0,
        dropped: v?.dropped ?? 0,
        corrected: v?.corrected ?? 0,
        verifierRan: v?.verifier ?? false,
        ...language(texts.map((t) => t.text).concat(r.review.verdict), lang),
        items: r.review.patterns.length + r.review.keyRounds.length,
      };
    }
    const deep =
      purpose === "review_deep"
        ? computeDeep(analysis, steamId, replay)
        : undefined;
    const r = await aiCoaching(analysis, config, {
      focusSteamId: steamId,
      lang,
      tier: deep ? "deep" : "quick",
      ...(deep ? { deep } : {}),
      verify,
      ...(options.fetch ? { fetch: options.fetch } : {}),
    });
    const facts = [...analysis.evidence, ...(deep?.evidence ?? [])].map(
      (e) => ({ ...sampled(e), eventIds: e.eventIds }),
    );
    const texts = coachingTexts(r.coaching);
    const g = grounding(texts, contextOf(analysis, facts));
    const v = r.coaching.provenance?.verification;
    return {
      ...base,
      ok: true,
      ...meta(r.call, r.coaching.provenance?.promptVersion, options.prices),
      numbers: g.numbers,
      numbersMatched: g.matched,
      claims: v?.claims ?? 0,
      dropped: v?.dropped ?? 0,
      corrected: v?.corrected ?? 0,
      verifierRan: v?.verifier ?? false,
      ...language(
        [
          ...texts.map((t) => t.text),
          r.coaching.verdict ?? "",
          ...r.coaching.insights.map((i) => i.actionablePractice),
          ...(r.coaching.planItems ?? []).map((p) => p.text),
        ],
        lang,
      ),
      items: r.coaching.insights.length + (r.coaching.keyMoments?.length ?? 0),
    };
  } catch (error) {
    return {
      ...base,
      ok: false,
      error:
        error instanceof Error ? error.message.slice(0, 300) : String(error),
    };
  }
}

function meta(
  call: {
    model: string;
    latencyMs: number;
    usage?: { inputTokens?: number; outputTokens?: number };
  },
  promptVersion: string | undefined,
  prices?: Prices,
) {
  const price = prices?.[call.model];
  const input = call.usage?.inputTokens;
  const output = call.usage?.outputTokens;
  return {
    model: call.model,
    ...(promptVersion ? { promptVersion } : {}),
    latencyMs: call.latencyMs,
    ...(input !== undefined ? { inputTokens: input } : {}),
    ...(output !== undefined ? { outputTokens: output } : {}),
    costUsd:
      price && input !== undefined && output !== undefined
        ? Math.round(
            ((input * price.input + output * price.output) / 1e6) * 1e5,
          ) / 1e5
        : null,
  };
}

export function summarize(runs: EvalRun[]): EvalReport["summary"] {
  const ok = runs.filter((r) => r.ok);
  const numbers = ok.reduce((n, r) => n + r.numbers, 0);
  const matched = ok.reduce((n, r) => n + r.numbersMatched, 0);
  const claims = ok.reduce((n, r) => n + r.claims, 0);
  const rejected = ok.reduce((n, r) => n + r.dropped + r.corrected, 0);
  const judged = ok.filter((r) => r.languagePure !== null);
  const costs = ok
    .map((r) => r.costUsd)
    .filter((c): c is number => typeof c === "number");
  const latency = mean(ok.map((r) => r.latencyMs ?? 0));
  const byPurpose: EvalReport["summary"]["byPurpose"] = {};
  for (const p of new Set(runs.map((r) => r.purpose))) {
    const list = runs.filter((r) => r.purpose === p);
    const good = list.filter((r) => r.ok);
    const n = good.reduce((x, r) => x + r.numbers, 0);
    const l = mean(good.map((r) => r.latencyMs ?? 0));
    byPurpose[p] = {
      runs: list.length,
      failed: list.length - good.length,
      avgLatencyMs: l === null ? null : Math.round(l),
      groundingRate: n
        ? r2(good.reduce((x, r) => x + r.numbersMatched, 0) / n)
        : null,
    };
  }
  return {
    runs: runs.length,
    failed: runs.length - ok.length,
    groundingRate: numbers ? r2(matched / numbers) : null,
    droppedClaims: ok.reduce((n, r) => n + r.dropped, 0),
    correctedClaims: ok.reduce((n, r) => n + r.corrected, 0),
    verifierRejectionRate: claims ? r2(rejected / claims) : null,
    languagePurity: judged.length
      ? r2(judged.filter((r) => r.languagePure).length / judged.length)
      : null,
    avgLatencyMs: latency === null ? null : Math.round(latency),
    costUsd: costs.length
      ? Math.round(costs.reduce((a, b) => a + b, 0) * 1e4) / 1e4
      : null,
    byPurpose,
  };
}

/** Markdown version of a report (artifacts/eval/*.md). */
export function evalMarkdown(report: EvalReport): string {
  const s = report.summary;
  const pct = (v: number | null) =>
    v === null ? "n/a" : `${Math.round(v * 100)}%`;
  const lines = [
    `# AI eval ${report.createdAt}`,
    "",
    `Cases: ${report.cases.join(", ")}`,
    "",
    "| Metric | Value |",
    "| --- | --- |",
    `| Runs (failed) | ${s.runs} (${s.failed}) |`,
    `| Numbers grounded | ${pct(s.groundingRate)} |`,
    `| Claims dropped / corrected | ${s.droppedClaims} / ${s.correctedClaims} |`,
    `| Verifier rejection rate | ${pct(s.verifierRejectionRate)} |`,
    `| Language purity | ${pct(s.languagePurity)} |`,
    `| Avg latency | ${s.avgLatencyMs ?? "n/a"} ms |`,
    `| Cost | ${s.costUsd === null ? "n/a" : `US$${s.costUsd}`} |`,
    "",
    "| Case | Purpose | Lang | OK | Model | Prompt | Latency ms | Numbers ok | Dropped | Corrected | EN share |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...report.runs.map(
      (r) =>
        `| ${r.case} | ${r.purpose} | ${r.lang} | ${r.ok ? "yes" : `no: ${(r.error ?? "").replace(/\|/g, "/").slice(0, 80)}`} | ${r.model ?? ""} | ${r.promptVersion ?? ""} | ${r.latencyMs ?? ""} | ${r.numbersMatched}/${r.numbers} | ${r.dropped} | ${r.corrected} | ${r.languageShare ?? ""} |`,
    ),
  ];
  return lines.join("\n") + "\n";
}
