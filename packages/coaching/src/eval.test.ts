import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { analyzeDemo } from "@cs2/analytics";
import {
  evalMarkdown,
  loadAiConfig,
  runEval,
  unwrapData,
  type AiConfig,
} from "./index.js";

const analysis = () =>
  analyzeDemo(
    JSON.parse(
      readFileSync(
        new URL(
          "../../contracts/fixtures/normalized-demo-enriched.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  );
const config = (): AiConfig => {
  const r = loadAiConfig({
    AI_PROVIDER: "openrouter",
    AI_API_KEY: "sk-test",
    AI_MODEL: "test/model",
  });
  if (!r.ok) throw new Error(r.reason);
  return r.config;
};
const fake = (async (_url: string, init: RequestInit) => {
  const body = JSON.parse(String(init.body)) as {
    messages: { content: string }[];
  };
  const data = unwrapData(body.messages[1]!.content) as Record<string, unknown>;
  const system = body.messages[0]!.content;
  const facts = (data.facts ?? []) as { id: string }[];
  const content = system.includes("fact checker")
    ? {
        results: (data.claims as { id: string; text: string }[]).map((c) => ({
          id: c.id,
          supported: !/99/.test(c.text),
          correctedText: "",
        })),
      }
    : data.roundCandidates
      ? {
          verdict: "Trade more as a team.",
          roles: [],
          patterns: [
            {
              scope: "general",
              text: "Only 20% of your deaths were traded.",
              evidenceIds: ["team-traded-deaths"],
              confidence: "low",
            },
          ],
          keyRounds: [],
          plan: [],
          caveats: [],
        }
      : {
          verdict: "Troque mais.",
          summary:
            "Jogue mais perto do time quando a rodada abrir, sempre com a troca pronta, e nunca entre sozinho no bomb antes da utilidade do time.",
          insights: [
            {
              observation: "Você morreu 3 vezes e só 1 foi trocada.",
              evidenceIds: [facts[0]!.id],
              confidence: "low",
              actionablePractice: "Jogue perto do time.",
              caveats: [],
              kind: "improve",
              scope: "general",
            },
            {
              observation: "Você fez 99 abates.",
              evidenceIds: [facts[0]!.id],
              confidence: "low",
              actionablePractice: "Mantenha.",
              caveats: [],
              kind: "strength",
              scope: "general",
            },
          ],
          keyMoments: [],
          drills: [],
          plan: [],
        };
  return new Response(
    JSON.stringify({
      model: "test/model",
      usage: { prompt_tokens: 1000, completion_tokens: 200 },
      choices: [
        {
          finish_reason: "stop",
          message: { content: JSON.stringify(content) },
        },
      ],
    }),
  );
}) as unknown as typeof fetch;

describe("AI eval", () => {
  it("scores grounding, rejections, language, latency and cost per purpose", async () => {
    const report = await runEval(
      [{ name: "fixture", analysis: analysis(), steamId: "a" }],
      {
        configs: {
          review_quick: config(),
          review_deep: config(),
          review_team: config(),
        },
        verifier: config(),
        langs: ["pt"],
        prices: { "test/model": { input: 1, output: 2 } },
        fetch: fake,
      },
    );
    expect(report.runs.map((r) => [r.purpose, r.ok])).toEqual([
      ["review_quick", true],
      ["review_deep", true],
      ["review_team", true],
    ]);
    const quick = report.runs[0]!;
    expect(quick.dropped).toBeGreaterThanOrEqual(1);
    expect(quick.costUsd).toBe(0.0014);
    expect(quick.languagePure).toBe(true);
    expect(report.summary.groundingRate).toBe(1);
    expect(report.summary.byPurpose.review_team!.runs).toBe(1);
    expect(evalMarkdown(report)).toContain(
      "| fixture | review_team | pt | yes |",
    );
  });
});
