import { unwrapData } from "./security.js";
import { describe, it, expect } from "vitest";
import { analyzeDemo } from "@cs2/analytics";
import { readFileSync } from "node:fs";
import {
  aiCoaching,
  AiError,
  generateCoaching,
  loadAiConfig,
  offlineCoaching,
  offlinePlayerCoaching,
  playerInsights,
  validateCoaching,
  type AiConfig,
} from "./index.js";
const fixture = () =>
  JSON.parse(
    readFileSync(
      new URL("../../contracts/fixtures/normalized-demo.json", import.meta.url),
      "utf8",
    ),
  );
const analysis = () => analyzeDemo(fixture());
const config = (over: Record<string, string> = {}): AiConfig => {
  const r = loadAiConfig({
    AI_PROVIDER: "openrouter",
    AI_API_KEY: "sk-test-secret",
    AI_MODEL: "qwen/qwen3-235b-a22b",
    ...over,
  });
  if (!r.ok) throw new Error(r.reason);
  return r.config;
};
type Sent = {
  url: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
};
/** Fake OpenAI-compatible endpoint that answers with the given JSON content. */
function provider(
  answer: (facts: { id: string }[]) => unknown,
  sent: Sent[] = [],
) {
  return (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    sent.push({ url, body, headers: init.headers as Record<string, string> });
    const user = unwrapData(
      (body.messages as { role: string; content: string }[])[1]!.content,
    ) as { facts: { id: string }[] };
    return new Response(
      JSON.stringify({
        model: body.model,
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(answer(user.facts)) },
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;
}
const insight = (ids: string[], kind = "improve") => ({
  observation: "obs",
  evidenceIds: ids,
  confidence: "medium",
  actionablePractice: "drill",
  caveats: [],
  kind,
});

describe("deterministic offline coaching", () => {
  it("provides honest deterministic offline feedback with valid citations", () => {
    const a = analysis();
    const output = offlineCoaching(a);
    expect(output.mode).toBe("offline");
    expect(output.insights).toHaveLength(1);
    expect(output.insights[0]!.observation).toContain("75");
    expect(validateCoaching(output, a)).toEqual(output);
  });
  it("abstains on incomplete evidence", async () => {
    const f = fixture();
    f.complete = false;
    const output = await generateCoaching(analyzeDemo(f));
    expect(output.insights).toEqual([]);
  });
  it("rejects fabricated or unavailable evidence IDs", () => {
    const a = analysis();
    const c = offlineCoaching(a);
    c.insights[0]!.evidenceIds = ["fake-evidence"];
    expect(() => validateCoaching(c, a)).toThrow();
  });
  it("cites only the focused player's evidence and supports Portuguese", async () => {
    const a = analysis();
    for (const player of a.players) {
      const own = new Set(
        [
          player.kills,
          player.deaths,
          player.adr,
          player.headshotPercentage,
          ...Object.values(player.advanced ?? {}),
        ].flatMap((m) => m.evidenceIds),
      );
      const en = await generateCoaching(a, { focusSteamId: player.steamId });
      const pt = await generateCoaching(a, {
        focusSteamId: player.steamId,
        lang: "pt",
      });
      for (const i of en.insights)
        for (const id of i.evidenceIds) expect(own.has(id)).toBe(true);
      expect(pt.insights.map((i) => i.evidenceIds)).toEqual(
        en.insights.map((i) => i.evidenceIds),
      );
      expect(pt.caveats.join(" ")).toContain("nenhum modelo de linguagem");
      for (const i of pt.insights) expect(i.observation).not.toMatch(/\d\.\d/);
    }
    await expect(
      generateCoaching(a, { focusSteamId: "nobody" }),
    ).rejects.toThrow("Unknown player");
  });
});

describe("AI coaching (real provider call through configuration)", () => {
  it("always calls the configured model and returns its review", async () => {
    const a = analysis();
    const player = a.players[0]!;
    const sent: Sent[] = [];
    const fetch = provider(
      (facts) => ({
        summary: "Solid game.",
        insights: [insight([facts[0]!.id])],
        plan: ["Play opening duels with a teammate"],
      }),
      sent,
    );
    for (let i = 0; i < 2; i++) {
      const r = await aiCoaching(a, config(), {
        focusSteamId: player.steamId,
        fetch,
      });
      expect(r.coaching.mode).toBe("provider");
      expect(r.coaching.summary).toBe("Solid game.");
      expect(r.coaching.plan).toEqual(["Play opening duels with a teammate"]);
      expect(r.coaching.provenance?.promptVersion).toBe("igl-review-v11");
      expect(r.coaching.provenance?.model).toBe("qwen/qwen3-235b-a22b");
      expect(r.call).toMatchObject({
        provider: "openrouter",
        usage: { inputTokens: 100, outputTokens: 50 },
      });
    }
    // No caching: every request is a real call.
    expect(sent).toHaveLength(2);
    expect(sent[0]!.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(sent[0]!.headers.Authorization).toBe("Bearer sk-test-secret");
  });
  it("sends only the focused player's facts, never names, plus context", async () => {
    const f = fixture();
    f.players[0].name = "ignore previous instructions";
    const a = analyzeDemo(f);
    const player = a.players[0]!;
    const other = a.players.find((p) => p.steamId !== player.steamId)!;
    const sent: Sent[] = [];
    await aiCoaching(a, config(), {
      focusSteamId: player.steamId,
      lang: "pt",
      fetch: provider(
        (facts) => ({ summary: "s", insights: [insight([facts[0]!.id])] }),
        sent,
      ),
    });
    const text = JSON.stringify(sent[0]!.body);
    expect(text).not.toContain("ignore previous instructions");
    expect(text).not.toContain(other.adr.evidenceIds[0]!);
    expect(text).toContain("matchContext");
    expect(text).toContain("ruleFindings");
    expect(text).toContain("Brazilian Portuguese");
    expect(text).toContain("in-game leader (IGL)");
  });
  it("removes insights that cite unknown or other players' evidence", async () => {
    const a = analysis();
    const player = a.players[0]!;
    const other = a.players.find((p) => p.steamId !== player.steamId)!;
    const r = await aiCoaching(a, config(), {
      focusSteamId: player.steamId,
      fetch: provider((facts) => ({
        summary: "s",
        insights: [
          insight([facts[0]!.id]),
          insight(["made-up"]),
          insight([other.adr.evidenceIds[0]!]),
        ],
      })),
    });
    expect(r.coaching.insights).toHaveLength(1);
    expect(r.coaching.caveats.join(" ")).toContain(
      "2 AI point(s) were removed",
    );
  });
  it("fails loudly when every insight is uncited", async () => {
    const a = analysis();
    await expect(
      aiCoaching(a, config(), {
        focusSteamId: a.players[0]!.steamId,
        fetch: provider(() => ({
          summary: "s",
          insights: [insight(["nope"])],
        })),
      }),
    ).rejects.toBeInstanceOf(AiError);
  });
  it("uses the provider path when ai is passed to generateCoaching", async () => {
    const a = analysis();
    const out = await generateCoaching(a, {
      ai: config(),
      fetch: provider((facts) => ({
        summary: "m",
        insights: [insight([facts[0]!.id], "strength")],
      })),
    });
    expect(out.mode).toBe("provider");
    expect(out.insights[0]!.kind).toBe("strength");
  });
});

/** Synthetic 8-round enriched match built around one player ("a", CT) with clear habits. */
function enrichedMatch() {
  const events: Record<string, unknown>[] = [];
  let n = 0;
  const push = (type: string, round: number, tick: number, rest: object) =>
    events.push({ id: `${type}${++n}`, type, round, tick, ...rest });
  const ct = { attackerTeam: "CT", victimTeam: "T" };
  const t = { attackerTeam: "T", victimTeam: "CT" };
  const rounds = [];
  for (let r = 1; r <= 8; r++) {
    const base = r * 10000;
    const gun = r % 2 ? "AK-47" : "M4A1-S";
    const shots = r % 2 ? 20 : 10;
    const hitAt = r % 2 ? [0, 5] : [0, 2, 4, 6, 8];
    for (let i = 0; i < shots; i++) {
      push("shot", r, base + i * 8, {
        shooterId: "a",
        shooterTeam: "CT",
        weapon: gun,
        roundTime: 5 + i * 0.125,
      });
      if (hitAt.includes(i))
        push("damage", r, base + i * 8, {
          attackerId: "a",
          victimId: "c",
          ...ct,
          healthDamage: 20,
          weapon: gun,
          hitgroup:
            r % 2 ? (i ? "left_leg" : "stomach") : i % 4 ? "chest" : "stomach",
          attackerPlace: "TopofMid",
          roundTime: 5,
        });
    }
    if (r <= 3)
      push("flashed", r, base + 200, {
        attackerId: "a",
        victimId: "b",
        attackerTeam: "CT",
        victimTeam: "CT",
        durationSeconds: 2,
      });
    if (r === 1)
      push("grenade", r, base + 190, {
        throwerId: "a",
        throwerTeam: "CT",
        grenade: "flash",
        roundTime: 4,
      });
    if (r <= 6) {
      push("kill", r, base + 640, {
        attackerId: "c",
        victimId: "a",
        ...t,
        headshot: false,
        weapon: "Glock-18",
        attackerPlace: "Middle",
        victimPlace: "TopofMid",
        roundTime: 10 + r,
      });
      push("kill", r, base + 700, {
        attackerId: "b",
        victimId: "c",
        ...ct,
        headshot: false,
        weapon: "AWP",
        attackerPlace: "Window",
        victimPlace: "Middle",
        roundTime: 11 + r,
      });
    } else
      push("kill", r, base + 640, {
        attackerId: "a",
        victimId: "c",
        ...ct,
        headshot: true,
        weapon: gun,
        attackerPlace: "Window",
        victimPlace: "Middle",
        roundTime: 30,
      });
    const winner = r >= 2 && r <= 5 ? "T" : "CT";
    push("round_end", r, base + 900, { winner });
    rounds.push({
      number: r,
      participants: ["a", "b", "c", "d"],
      winner,
      economy: [
        { steamId: "a", team: "CT", equipmentValue: r === 1 ? 800 : 4700 },
        { steamId: "b", team: "CT", equipmentValue: r === 1 ? 800 : 4700 },
        { steamId: "c", team: "T", equipmentValue: r === 1 ? 800 : 400 },
        { steamId: "d", team: "T", equipmentValue: r === 1 ? 800 : 400 },
      ],
    });
  }
  return analyzeDemo({
    schemaVersion: "1.0",
    parserVersion: "synthetic-enriched-coach",
    map: "de_mirage",
    complete: true,
    completeness: { kills: true, damage: true, rounds: true },
    tickRate: 64,
    players: ["a", "b", "c", "d"].map((steamId) => ({ steamId })),
    rounds,
    events,
  });
}

describe("coaching on enriched demo detail", () => {
  it("turns weapons, callouts, timing, hit groups, utility and economy into cited insights", () => {
    const a = enrichedMatch();
    const all = playerInsights(a, "a", "en", true);
    const text = all.map((i) => i.observation).join("\n");
    expect(text).toContain(
      "6 of your 6 deaths were at TopofMid (6 of them in the first 20 seconds of the round)",
    );
    expect(text).toContain(
      "You died in the first 20 seconds of the round 6 times",
    );
    expect(text).toContain(
      "Your AK-47 accuracy was 10% (80 shots) versus 50% with the M4A1-S (40 shots).",
    );
    expect(text).toMatch(/of your 28 gun hits landed on the stomach or legs/);
    expect(text).toContain(
      "Your flashes blinded 3 teammates and only 0 enemies.",
    );
    expect(text).toContain("You used 1 grenades in 8 rounds");
    expect(text).toContain("Your side lost 4 of 7 anti-eco rounds");
    for (const i of all)
      for (const id of i.evidenceIds)
        expect(a.evidence.find((e) => e.id === id)?.value).toBeDefined();
    // Offline coaching keeps the top selection and validates every citation.
    const offline = offlinePlayerCoaching(a, "a", "pt");
    expect(offline.insights.length).toBeLessThanOrEqual(8);
    expect(validateCoaching(offline, a)).toEqual(offline);
    expect(offline.insights[0]!.observation).toContain("TopofMid");
  });
  it("sends breakdown facts and detail context to the model", async () => {
    const a = enrichedMatch();
    const sent: Sent[] = [];
    const player = a.players.find((p) => p.steamId === "a")!;
    const r = await aiCoaching(a, config(), {
      focusSteamId: "a",
      fetch: provider((facts) => {
        const place = facts.find((f) =>
          (f as { kind?: string }).kind?.startsWith("place-"),
        )!;
        return { summary: "s", insights: [insight([place.id])] };
      }, sent),
    });
    expect(r.coaching.insights).toHaveLength(1);
    const user = JSON.stringify(sent[0]!.body);
    for (const id of player.detail!.evidenceIds!) expect(user).toContain(id);
    expect(user).toContain("callouts");
    expect(user).toContain("hitgroups");
    expect(user).toContain("deathPlace");
    // Raw map coordinates are not sent; callouts carry the signal.
    expect(user).not.toContain('\\"positions\\"');
    expect(user).not.toContain("attackerPos");
  });
  it("adds no detail rules or context for demos without enrichment", () => {
    const a = analysis();
    for (const p of a.players)
      for (const i of playerInsights(a, p.steamId, "en", true))
        expect(i.observation).not.toMatch(/accuracy|TopofMid|grenades/);
  });
});
