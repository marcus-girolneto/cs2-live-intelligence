import { describe, expect, it } from "vitest";
import { aiLiveCall } from "./live.js";
import {
  accentlessCount,
  lacksDiacritics,
  restoreDiacritics,
} from "./orthography.js";
import { loadAiConfig, type AiConfig } from "./provider.js";

const config = (): AiConfig => {
  const r = loadAiConfig({
    AI_PROVIDER: "openrouter",
    AI_API_KEY: "k",
    AI_MODEL: "m",
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
  recentRounds: [
    { round: 1, kills: 1, died: true },
    { round: 2, kills: 0, died: true },
    { round: 3, kills: 1, died: true },
  ],
};
/** Answers each request with the next content; records the system prompts. */
const answers = (contents: unknown[], systems: string[]) =>
  (async (_u: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as {
      messages: { content: string }[];
    };
    systems.push(body.messages[0]!.content);
    const content = contents[Math.min(systems.length - 1, contents.length - 1)];
    return new Response(
      JSON.stringify({
        model: "m",
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(content) },
          },
        ],
      }),
    );
  }) as unknown as typeof fetch;
const bare = {
  call: "Nao jogue sozinho: voce precisa de troca na posicao.",
  why: "Tambem morreu cedo, entao segure com o time.",
  focus: "trade",
  confidence: "high",
};
const accented = {
  call: "Não jogue sozinho: você precisa de troca na posição.",
  why: "Também morreu cedo, então segure com o time.",
  focus: "trade",
  confidence: "high",
};

describe("orthography", () => {
  it("finds accent-less forms per language, whole words only", () => {
    expect(accentlessCount("Nao, voce nao estava na posicao.", "pt")).toBe(4);
    expect(accentlessCount("Não, você não estava na posição.", "pt")).toBe(0);
    expect(accentlessCount("nanao naoo", "pt")).toBe(0);
    expect(lacksDiacritics("tambien despues", "es")).toBe(true);
    expect(lacksDiacritics("deja tres", "fr")).toBe(true);
    expect(lacksDiacritics("fur uber", "de")).toBe(true);
    expect(lacksDiacritics("sie wiecej", "pl")).toBe(true);
    expect(lacksDiacritics("icin degil", "tr")).toBe(true);
    expect(lacksDiacritics("nao voce", "en")).toBe(false);
    expect(lacksDiacritics("Analise o round 5 e esta jogada.", "pt")).toBe(
      false,
    );
  });
  it("restores the listed words and keeps the case", () => {
    expect(
      restoreDiacritics("Nao jogue; VOCE perdeu o pos-plant na posicao.", "pt"),
    ).toBe("Não jogue; VOCÊ perdeu o pós-plant na posição.");
    expect(restoreDiacritics("MP9 e AK-47 no meio", "pt")).toBe(
      "MP9 e AK-47 no meio",
    );
  });
  it("retries once with a stronger reminder and keeps the accented answer", async () => {
    const systems: string[] = [];
    const r = await aiLiveCall(input, config(), {
      lang: "pt",
      fetch: answers([bare, accented], systems),
    });
    expect(systems).toHaveLength(2);
    expect(systems[1]).toContain("ORTHOGRAPHY (mandatory)");
    expect(r.call.call).toBe(accented.call);
    expect(r.meta.attempts).toBe(2);
  });
  it("auto-corrects when the retry is still accent-less, without a caveat", async () => {
    const systems: string[] = [];
    const r = await aiLiveCall(input, config(), {
      lang: "pt",
      fetch: answers([bare, bare], systems),
    });
    expect(systems).toHaveLength(2);
    expect(r.call.call).toBe(accented.call);
    expect(r.call.why).toBe(accented.why);
  });
  it("does not retry English or correctly accented answers", async () => {
    const systems: string[] = [];
    await aiLiveCall(input, config(), {
      lang: "pt",
      fetch: answers([accented], systems),
    });
    expect(systems).toHaveLength(1);
  });
});
