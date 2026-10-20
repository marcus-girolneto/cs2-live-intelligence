import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { analyzeDemo } from "@cs2/analytics";
import { lobbyComparisonSchema, teamReviewSchema } from "@cs2/contracts";
import {
  aiTeamReview,
  aliasNames,
  analyzeTeam,
  nameTeamReview,
  replaceAliases,
  lobbyComparison,
  loadAiConfig,
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
type Body = { messages: { role: string; content: string }[] };
function provider(
  answer: (d: Record<string, unknown>) => unknown,
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
    return new Response(
      JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify(verify ? { results: [] } : answer(data)),
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as unknown as typeof fetch;
}

describe("team facts", () => {
  it("finds the team, aliases, trades, openings and candidates", () => {
    const t = analyzeTeam(analysis(), "a");
    expect(t.roster.members).toEqual(["a", "b"]);
    expect(t.roster.enemies).toEqual(["c", "d"]);
    expect(t.roster.alias.get("a")).toBe("P1");
    const traded = t.facts.find((f) => f.id === "team-traded-deaths")!;
    // a died 3 times (kill10 traded by b, kill23, kill36), b died twice (kill24, kill37).
    expect(traded.n).toBe(5);
    expect(traded.value).toBe(20);
    expect(traded.confidence).toBe("medium");
    expect(t.facts.find((f) => f.id === "team-opening-success")!.value).toBe(
      75,
    );
    for (const f of t.facts) {
      expect(f.description).not.toMatch(/\b[abcd]\b(?!\w)/);
      expect(f.id).toMatch(/^team-/);
    }
  });
});

describe("team review", () => {
  it("sends aliases only, maps them back and validates the answer", async () => {
    const a = analysis();
    const sent: Body[] = [];
    const r = await aiTeamReview(a, config(), {
      steamId: "a",
      verify: {},
      fetch: provider((d) => {
        const facts = d.facts as { id: string }[];
        const rounds = d.roundCandidates as { round: number }[];
        return {
          verdict: "Great openings, but you let deaths go untraded.",
          roles: [
            {
              alias: "P1",
              strengths: [
                {
                  text: "P1 wins openings.",
                  evidenceIds: ["team-opening-success"],
                },
              ],
              fixes: [{ text: "P1 dies untraded.", evidenceIds: ["nope"] }],
            },
          ],
          patterns: [
            {
              scope: "general",
              text: "Only 20% of your 5 deaths were traded.",
              evidenceIds: ["team-traded-deaths"],
              confidence: "high",
            },
            {
              scope: "general",
              text: "You traded 90% of deaths.",
              evidenceIds: [facts[0]!.id],
              confidence: "medium",
            },
          ],
          keyRounds: rounds.slice(0, 1).map((c) => ({
            round: c.round,
            title: "Lost the advantage",
            whatHappened: "You were up and lost the round.",
            whatToDoInstead: "Play for trades.",
          })),
          plan: [
            {
              text: "P2 trades P1's entry",
              owner: "P2",
              targetMetric: "tradedDeathsPct",
              direction: "up",
            },
            {
              text: "Throw flashes together",
              owner: "team",
              targetMetric: "bogus",
              direction: "up",
            },
          ],
          caveats: [],
        };
      }, sent),
    });
    const review = teamReviewSchema.parse(r.review);
    const user = sent[0]!.messages[1]!.content;
    expect(user).not.toMatch(/"(?:a|b|c|d)"/);
    expect(user).toContain('"alias":"P1"');
    expect(review.members).toEqual(["a", "b"]);
    expect(review.roles.find((x) => x.steamId === "a")!.fixes).toEqual([]);
    expect(review.patterns.map((p) => p.text)).toEqual([
      "Only 20% of your 5 deaths were traded.",
    ]);
    // Confidence is capped by the cited fact (medium sample).
    expect(review.patterns[0]!.confidence).toBe("medium");
    expect(review.plan[0]).toMatchObject({
      owner: "b",
      targetMetric: "tradedDeathsPct",
    });
    // Aliases never reach the user: every text carries the players' names.
    expect(review.plan[0]!.text).toBe("Player B trades Player A's entry");
    expect(
      review.roles.find((x) => x.steamId === "a")!.strengths[0]!.text,
    ).toBe("Player A wins openings.");
    expect(
      JSON.stringify(review).replace(
        /"(?:id|evidenceIds)":(?:"[^"]*"|\[[^\]]*\])/g,
        "",
      ),
    ).not.toMatch(/(?<![\p{L}\p{N}_])P[1-5](?![\p{L}\p{N}_])/u);
    expect(review.plan[1]).toMatchObject({
      owner: "team",
      targetMetric: "utilityDamagePerRound",
    });
    expect(review.provenance).toMatchObject({ promptVersion: "igl-team-v4" });
    expect(review.provenance!.verification!.dropped).toBeGreaterThanOrEqual(1);
    expect(review.teamScores).toBeDefined();
  });
  it("leaves deaths to flagged opponents out", async () => {
    const r = await aiTeamReview(analysis(), config(), {
      steamId: "a",
      integrity: { players: [{ steamId: "d", level: "high" }] },
      fetch: provider(() => ({
        verdict: "Fine.",
        roles: [],
        patterns: [
          {
            scope: "general",
            text: "Trades.",
            evidenceIds: ["team-traded-deaths"],
            confidence: "low",
          },
        ],
        keyRounds: [],
        plan: [],
        caveats: [],
      })),
    });
    const traded = r.review.facts.find((f) => f.id === "team-traded-deaths")!;
    expect(traded.n).toBe(3);
    expect(r.review.caveats.join(" ")).toMatch(/weren't counted against you/);
  });
});

describe("team aliases", () => {
  const players = [
    { steamId: "a", name: "s1mple\u0000" },
    { steamId: "b", name: "" },
  ] as unknown as Parameters<typeof nameTeamReview>[1];
  it("replaces whole-word aliases in Portuguese text and keeps other words", () => {
    const names = aliasNames(["a", "b"], players, "pt");
    expect(names.get("P1")).toBe("s1mple");
    expect(names.get("P2")).toBe("Jogador 2");
    expect(
      replaceAliases(
        "O P1 trocou pelo P2; P1 e P2 no MP9 e AP1X; P3 fica.",
        names,
      ),
    ).toBe(
      "O s1mple trocou pelo Jogador 2; s1mple e Jogador 2 no MP9 e AP1X; P3 fica.",
    );
  });
  it("maps every human-readable field of a stored review", async () => {
    const r = await aiTeamReview(analysis(), config(), {
      steamId: "a",
      fetch: provider(() => ({
        verdict: "P1 carries.",
        roles: [],
        patterns: [
          {
            scope: "general",
            text: "P2 trades.",
            evidenceIds: ["team-traded-deaths"],
            confidence: "low",
          },
        ],
        keyRounds: [],
        plan: [],
        caveats: ["P2 had few rounds."],
      })),
    });
    const stored = { ...r.review, verdict: "P2 and P1 win." };
    const named = nameTeamReview(stored, analysis().players, "en");
    expect(named.verdict).toBe("Player B and Player A win.");
    expect(named.caveats).toContain("Player B had few rounds.");
    expect(nameTeamReview(named, analysis().players).verdict).toBe(
      named.verdict,
    );
  });
});

describe("lobby comparison", () => {
  it("ranks the player against the lobby", () => {
    const l = lobbyComparisonSchema.parse(lobbyComparison(analysis(), "a"));
    const adr = l.metrics.find((m) => m.key === "adr")!;
    expect(adr.rank).toBeGreaterThanOrEqual(1);
    expect(adr.players).toBe(4);
    expect(adr.best).toBeGreaterThanOrEqual(adr.lobbyMedian!);
  });
});
