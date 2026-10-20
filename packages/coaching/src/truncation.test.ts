import { describe, expect, it } from "vitest";
import { aiLiveCall } from "./live.js";
import { retryConfig } from "./prompt-kit.js";
import { AiError, loadAiConfig, type AiConfig } from "./provider.js";

const config = (env: Record<string, string> = {}): AiConfig => {
  const r = loadAiConfig({
    AI_PROVIDER: "openrouter",
    AI_API_KEY: "k",
    AI_MODEL: "m",
    AI_MAX_OUTPUT_TOKENS: "6000",
    ...env,
  });
  if (!r.ok) throw new Error(r.reason);
  return r.config;
};
const input = {
  map: "de_mirage",
  phase: "freezetime",
  round: 5,
  score: { ct: 1, t: 3 },
  own: { kills: 2, deaths: 4, assists: 1, health: 100, armor: 0 },
  recentRounds: [{ round: 1, kills: 1, died: true }],
};
const answer = {
  call: "Play with a teammate for the trade.",
  why: "You died alone in round 1.",
  focus: "trade",
  confidence: "low",
};
const replies = (finish: string[], bodies: Record<string, unknown>[]) =>
  (async (_u: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    const reason = finish[Math.min(bodies.length - 1, finish.length - 1)];
    return new Response(
      JSON.stringify({
        model: "m",
        choices: [
          {
            finish_reason: reason,
            message: {
              content:
                reason === "length" ? '{"call":"Pla' : JSON.stringify(answer),
            },
          },
        ],
      }),
    );
  }) as unknown as typeof fetch;

describe("truncated answers", () => {
  it("retry once with twice the budget and low reasoning effort", async () => {
    const bodies: Record<string, unknown>[] = [];
    const r = await aiLiveCall(input, config(), {
      lang: "en",
      fetch: replies(["length", "stop"], bodies),
    });
    expect(r.call.call).toBe(answer.call);
    expect(bodies).toHaveLength(2);
    expect(bodies[0]!.max_tokens).toBe(6000);
    expect(bodies[1]!.max_tokens).toBe(12_000);
    expect(bodies[1]!.reasoning).toEqual({ effort: "low" });
    expect(r.meta.attempts).toBe(2);
  });
  it("fail as truncated when the retry is cut off too", async () => {
    const bodies: Record<string, unknown>[] = [];
    const err = await aiLiveCall(input, config(), {
      lang: "en",
      fetch: replies(["length"], bodies),
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiError);
    expect((err as AiError).code).toBe("truncated");
    expect(bodies).toHaveLength(2);
  });
  it("use the purpose default when it is larger than twice the budget", () => {
    const c = retryConfig(
      config({ AI_MAX_OUTPUT_TOKENS: "1000" }),
      "personal_coach",
    );
    expect(c.maxOutputTokens).toBe(32_000);
    const openai = retryConfig(
      config({ AI_PROVIDER: "openai", AI_MAX_OUTPUT_TOKENS: "1000" }),
      "live",
    );
    expect(openai.extraBody).toEqual({ reasoning_effort: "low" });
  });
});
