import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { analyzeDemo } from "@cs2/analytics";
import { coachingSchema } from "@cs2/contracts";
import {
  abBucket,
  aiCoaching,
  checkClaim,
  confidenceFor,
  enforceConfidence,
  fairAnalysis,
  flaggedOpponents,
  guardOutput,
  inferTarget,
  loadAiConfig,
  longestRun,
  newBoundary,
  numbersIn,
  planTarget,
  roundsIn,
  sampleSize,
  unwrapData,
  variantFor,
  variantPrompt,
  POST_MATCH_PROMPT_VERSION,
  POST_MATCH_SYSTEM_PROMPT,
  UNUSUAL_OPPONENT_CAVEAT,
  type AiConfig,
  type ClaimContext,
} from "./index.js";

const enriched = () =>
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
type Body = { messages: { role: string; content: string }[] };
/** Fake provider: answers review calls with `review`, verifier calls with `verdicts`. */
function provider(
  review: (data: Record<string, unknown>) => unknown,
  verdicts?: (data: Record<string, unknown>) => unknown,
  sent: Body[] = [],
) {
  return (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Body;
    sent.push(body);
    const data = unwrapData(body.messages[1]!.content) as Record<
      string,
      unknown
    >;
    const verify = body.messages[0]!.content.includes("fact checker");
    const answer = verify ? verdicts?.(data) : review(data);
    return new Response(
      JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(answer) },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as unknown as typeof fetch;
}

describe("fact confidence", () => {
  it("derives n from the rate denominator or the events", () => {
    expect(
      sampleSize({ description: "traded-deaths: 1 / 3; x", eventIds: ["a"] }),
    ).toBe(3);
    expect(
      sampleSize({ description: "kills: 7 / 1", eventIds: ["a", "b"] }),
    ).toBe(2);
  });
  it("uses low < 5, medium 5-14, high >= 15 by default and stricter shot thresholds", () => {
    expect(confidenceFor("opening-success", 4)).toBe("low");
    expect(confidenceFor("opening-success", 5)).toBe("medium");
    expect(confidenceFor("opening-success", 15)).toBe("high");
    expect(confidenceFor("accuracy", 15)).toBe("low");
    expect(confidenceFor("accuracy", 80)).toBe("high");
  });
  it("caps insights at their best cited fact and ranks low ones last", () => {
    const facts = new Map([
      ["lo", { confidence: "low" as const }],
      ["hi", { confidence: "high" as const }],
    ]);
    const out = enforceConfidence(
      [
        { evidenceIds: ["lo"], confidence: "high" as const, name: "first" },
        { evidenceIds: ["hi"], confidence: "medium" as const, name: "second" },
      ],
      facts,
    );
    expect(out.map((i) => [i.name, i.confidence])).toEqual([
      ["second", "medium"],
      ["first", "low"],
    ]);
  });
});

describe("deterministic claim checks", () => {
  const ctx: ClaimContext = {
    facts: new Map([
      [
        "f1",
        {
          value: 33.33,
          n: 3,
          description: "traded-deaths: 1 / 3; complete=true",
          eventIds: ["k1", "k2"],
        },
      ],
      ["f2", { value: 0.63, n: 20, description: "flash rate" }],
    ]),
    eventRounds: new Map([
      ["k1", 3],
      ["k2", 7],
      ["k3", 8],
      ["k4", 9],
    ]),
    totalRounds: 24,
  };
  it("reads EN/PT numbers and ignores situations and weapon names", () => {
    expect(
      numbersIn("33,3% with the AK-47 in a 2v4, 0.63").map((n) => n.value),
    ).toEqual([33.3, 0.63]);
    expect(roundsIn("rounds 3, 4 e 5 and rodada 12")).toEqual([3, 4, 5, 12]);
    expect(roundsIn("rodadas 4 a 6")).toEqual([4, 5, 6]);
  });
  it("accepts numbers matching cited facts with rounding and locale tolerance", () => {
    for (const text of [
      "Only 33% of your 3 deaths were traded.",
      "Só 33,3% das suas 3 mortes foram trocadas.",
      "1 of 3 deaths traded, in rounds 3 and 7.",
    ])
      expect(checkClaim({ key: "x", text, factIds: ["f1"] }, ctx).ok).toBe(
        true,
      );
    expect(
      checkClaim({ key: "x", text: "63% of flashes", factIds: ["f2"] }, ctx).ok,
    ).toBe(true);
  });
  it("rejects invented numbers and rounds outside the cited events", () => {
    const r = checkClaim(
      { key: "x", text: "Only 12% traded in round 9.", factIds: ["f1"] },
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.unmatched).toEqual([12]);
    expect(r.badRounds).toEqual([9]);
  });
  it("rejects 'consecutive' claims on rounds that do not follow each other", () => {
    expect(longestRun([3, 7, 8, 9])).toBe(3);
    const bad = checkClaim(
      { key: "x", text: "Você morreu 2 rounds seguidos.", factIds: ["f1"] },
      ctx,
    );
    expect(bad.consecutive).toBe(true);
    const good = checkClaim(
      {
        key: "x",
        text: "You died 3 rounds in a row.",
        factIds: [],
        eventIds: ["k2", "k3", "k4"],
      },
      ctx,
    );
    expect(good.ok).toBe(true);
  });
});

const answer = (fact: string, observation: string) => ({
  verdict: "Trade your deaths.",
  summary: "Trade more.",
  insights: [
    {
      observation,
      evidenceIds: [fact],
      confidence: "high",
      actionablePractice: "Play within 5 s of a teammate.",
      caveats: [],
      kind: "improve",
      scope: "general",
    },
    {
      observation: "You opened 3 rounds in a row with a kill.",
      evidenceIds: [fact],
      confidence: "medium",
      actionablePractice: "Keep entering with a flash.",
      caveats: [],
      kind: "strength",
      scope: "general",
    },
  ],
  keyMoments: [],
  drills: [],
  plan: [
    {
      text: "Trade your entry",
      scope: "general",
      targetMetric: "tradedDeathsPct",
      direction: "up",
    },
  ],
});

describe("verified reviews", () => {
  it("drops unsupported claims, applies corrections and records the stats", async () => {
    const a = enriched();
    const tradedId = a.evidence.find((e) => e.kind === "traded-deaths")!.id;
    const sent: Body[] = [];
    const r = await aiCoaching(a, config(), {
      focusSteamId: "a",
      verify: { config: config() },
      fetch: provider(
        () => answer(tradedId, "Only 1 of your 3 deaths was traded."),
        (d) => {
          const claims = d.claims as { id: string; text: string }[];
          return {
            results: claims.map((c) => ({
              id: c.id,
              supported: !/opened/.test(c.text) && !/Trade more/.test(c.text),
              correctedText: /Trade more/.test(c.text)
                ? "Trade your deaths more often."
                : "",
            })),
          };
        },
        sent,
      ),
    });
    const c = coachingSchema.parse(r.coaching);
    expect(sent).toHaveLength(2);
    // The verifier only sees the claims and the cited facts.
    const verifierData = unwrapData(sent[1]!.messages[1]!.content) as {
      claims: { facts: unknown[] }[];
    };
    expect(Object.keys(verifierData)).toEqual(["claims"]);
    expect(c.insights.map((i) => i.observation)).toEqual([
      "Only 1 of your 3 deaths was traded.",
    ]);
    expect(c.summary).toBe("Trade your deaths more often.");
    expect(c.provenance?.verification).toMatchObject({
      verifier: true,
      dropped: 1,
      corrected: 1,
    });
    expect(c.provenance!.verification!.claims).toBeGreaterThanOrEqual(4);
    expect(c.caveats.join(" ")).toMatch(/removed because the match data/);
  });
  it("still applies the number checks when the verifier is off or fails", async () => {
    const a = enriched();
    const tradedId = a.evidence.find((e) => e.kind === "traded-deaths")!.id;
    const r = await aiCoaching(a, config(), {
      focusSteamId: "a",
      verify: {},
      fetch: provider(() => answer(tradedId, "Only 12% of 9 deaths traded.")),
    });
    expect(r.coaching.insights).toHaveLength(1);
    expect(r.coaching.insights[0]!.observation).toBe(
      "You opened 3 rounds with a kill.",
    );
    expect(r.coaching.provenance?.verification).toMatchObject({
      verifier: false,
      numberFailures: 2,
    });
  });
});

describe("unusual opponents", () => {
  it("removes deaths to flagged opponents from events and metrics", () => {
    const a = enriched();
    const flagged = flaggedOpponents({
      players: [
        { steamId: "d", level: "high", reasons: [] },
        { steamId: "c", level: "elevated", reasons: [] },
      ],
      bannedAfterMatch: [],
    });
    expect([...flagged]).toEqual(["d"]);
    const fair = fairAnalysis(a, "a", flagged);
    expect(fair.excluded.sort()).toEqual(["kill10", "kill36"]);
    expect([...fair.rounds].sort()).toEqual([1, 4]);
    const p = fair.analysis.players.find((x) => x.steamId === "a")!;
    expect(p.deaths.value).toBe(1);
    expect(p.advanced!.survival!.value).toBe(75);
    expect(p.advanced!["traded-deaths"]!.value).toBe(0);
    const e = fair.analysis.evidence.find(
      (x) => x.id === p.deaths.evidenceIds[0],
    );
    expect(e!.value).toBe(1);
    expect(fair.analysis.events!.some((x) => x.id === "kill10")).toBe(false);
  });
  it("tells the model only a count and a per-round flag, and adds the neutral caveat", async () => {
    const a = enriched();
    const fair = fairAnalysis(
      a,
      "a",
      flaggedOpponents({
        bannedAfterMatch: [{ steamId: "d", bannedAfterMatch: true }],
      }),
    );
    const sent: Body[] = [];
    const id = fair.analysis.evidence.find((e) => e.kind === "kast")!.id;
    const r = await aiCoaching(fair.analysis, config(), {
      focusSteamId: "a",
      fair: { excluded: fair.excluded, rounds: [...fair.rounds] },
      fetch: provider(
        () => ({ ...answer(id, "KAST 100%."), plan: [] }),
        undefined,
        sent,
      ),
    });
    const data = unwrapData(sent[0]!.messages[1]!.content) as {
      deathsNotCounted: number;
      perRound: { round: number; opponentFlagged?: boolean }[];
    };
    expect(data.deathsNotCounted).toBe(2);
    expect(
      data.perRound.filter((r) => r.opponentFlagged).map((r) => r.round),
    ).toEqual([1, 4]);
    expect(JSON.stringify(data)).not.toMatch(/integrity|banned|"d"/i);
    expect(r.coaching.excludedDeaths).toMatchObject({ count: 2 });
    expect(r.coaching.caveats).toContain(UNUSUAL_OPPONENT_CAVEAT.en);
  });
  it("blocks accusations in model text (all output languages)", () => {
    const b = newBoundary();
    for (const text of [
      "Your killer was a cheater.",
      "Ele estava de wall, nada a fazer.",
      "O oponente era trapaceiro.",
      "He used an aimbot.",
      "Esse cara é hacker.",
      "El rival era un tramposo.",
      "Ese tipo estaba chetado.",
      "Этот соперник явно читер.",
      "Он играл с вх.",
      "这个对手开挂了。",
      "对面是挂狗，没办法。",
      "Der Gegner ist ein Betrüger.",
      "L'adversaire est un tricheur.",
      "Przeciwnik to cziter.",
      "Rakip hileci, yapacak bir şey yok.",
    ]) {
      const r = guardOutput(
        {
          verdict: "ok fine verdict",
          summary: "A fine summary.",
          headline: "Fine headline here.",
          insights: [{ observation: text }],
        },
        {
          fields: ["verdict", "summary", "headline"],
          items: { insights: { fields: ["observation"] } },
        },
        { prompt: "", boundary: b, lang: "en" },
      );
      expect((r.data as { insights: unknown[] }).insights).toHaveLength(0);
      expect(["accusation", "cheat"]).toContain(r.issues[0]!.reason);
    }
  });
});

describe("plan targets", () => {
  it("validates the model's target and infers one for old items", () => {
    expect(planTarget("x", "kast", "down")).toEqual({
      targetMetric: "kast",
      direction: "down",
    });
    expect(planTarget("Trade your entry", "bogus", "up").targetMetric).toBe(
      "tradedDeathsPct",
    );
    expect(inferTarget("Não jogue sozinho no bomb")).toEqual({
      targetMetric: "isolatedDeathsPct",
      direction: "down",
    });
    expect(inferTarget("Crosshair at head level").targetMetric).toBe(
      "crosshairOnTargetPct",
    );
    // Older degree targets are tracked as "already on the enemy" (higher is better).
    expect(planTarget("Pre-aim", "crosshairMedianDeg", "down")).toEqual({
      targetMetric: "crosshairOnTargetPct",
      direction: "up",
    });
    expect(inferTarget("Use mais granadas antes de entrar").targetMetric).toBe(
      "utilityDamagePerRound",
    );
    expect(inferTarget("Win the opening duel with a flash").targetMetric).toBe(
      "utilityDamagePerRound",
    );
    expect(inferTarget("Win your opening duels").targetMetric).toBe(
      "openingWinPct",
    );
    expect(inferTarget("Save on eco rounds").targetMetric).toBe("none");
  });
});

describe("prompt A/B", () => {
  it("splits users stably by hash and builds a pinned variant prompt", () => {
    expect(variantFor("u1", "review_quick", 0)).toBe("a");
    expect(variantFor("u1", "review_quick", 100)).toBe("b");
    expect(abBucket("u1", "review_quick")).toBe(abBucket("u1", "review_quick"));
    const b = variantPrompt(
      POST_MATCH_SYSTEM_PROMPT,
      POST_MATCH_PROMPT_VERSION,
      "b",
    );
    expect(b).toContain("VARIANT B");
    expect(b).toContain("FMK-CANARY");
    expect(b).not.toEqual(POST_MATCH_SYSTEM_PROMPT);
  });
});
