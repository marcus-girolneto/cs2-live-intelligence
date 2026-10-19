import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { analyzeDemo } from "@cs2/analytics";
import { coachingSchema, monthlyReportSchema } from "@cs2/contracts";
import {
  aiCoaching,
  aiMonthlyReport,
  buildMonthlyReport,
  computeDeep,
  DEEP_PROMPT_VERSION,
  loadAiConfig,
  POST_MATCH_PROMPT_VERSION,
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
    AI_API_KEY: "sk-test-secret",
    AI_MODEL: "test/model",
  });
  if (!r.ok) throw new Error(r.reason);
  return r.config;
};
type Body = {
  messages: { role: string; content: string }[];
  response_format?: { json_schema?: { name?: string } };
};
function provider(
  answer: (data: Record<string, unknown>) => unknown,
  sent: Body[] = [],
) {
  return (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Body;
    sent.push(body);
    const user = body.messages[1]!.content;
    const data = JSON.parse(user.slice(user.indexOf("{"))) as Record<
      string,
      unknown
    >;
    return new Response(
      JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(answer(data)) },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as unknown as typeof fetch;
}

describe("review tiers", () => {
  it("deep reviews send the deep modules, allow citing deep facts and attach coaching.deep", async () => {
    const a = analysis();
    const focus = a.players[0]!.steamId;
    const deep = computeDeep(a, focus);
    const sent: Body[] = [];
    const fetch = provider((data) => {
      const facts = data.facts as { id: string }[];
      const deepFact = facts.find((f) => f.id.startsWith("deep-"))!;
      const candidates = data.momentCandidates as { id: string }[];
      return {
        verdict: "Deep look.",
        summary: "S.",
        insights: [
          {
            observation: "Utility.",
            evidenceIds: [deepFact.id],
            confidence: "low",
            actionablePractice: "P.",
            caveats: [],
            kind: "improve",
            scope: "general",
          },
          {
            observation: "Bogus.",
            evidenceIds: ["deep-made-up"],
            confidence: "low",
            actionablePractice: "P.",
            caveats: [],
            kind: "improve",
            scope: "general",
          },
        ],
        keyMoments: candidates.slice(0, 8).map((c) => ({
          eventId: c.id,
          title: "T",
          whatHappened: "W.",
          whatToDoInstead: "I.",
          kind: "mistake",
          scope: "general",
        })),
        drills: Array.from({ length: 6 }, (_, i) => ({
          name: `D${i}`,
          durationMinutes: 10,
          howTo: "H.",
          metric: "M.",
          scope: "general",
          area: i % 2 ? "utility" : "crosshair",
        })),
        plan: [{ text: "Do it.", scope: "general" }],
      };
    }, sent);
    const r = await aiCoaching(a, config(), {
      focusSteamId: focus,
      fetch,
      tier: "deep",
      deep,
    });
    expect(sent[0]!.messages[0]!.content).toContain("DEEP REVIEW");
    expect(sent[0]!.response_format?.json_schema?.name).toBe(
      "cs2_deep_coaching",
    );
    const payload = JSON.parse(
      sent[0]!.messages[1]!.content.slice(
        sent[0]!.messages[1]!.content.indexOf("{"),
      ),
    );
    expect(payload.deep.utility).toBeDefined();
    expect(r.coaching.tier).toBe("deep");
    expect(r.coaching.provenance?.promptVersion).toBe(DEEP_PROMPT_VERSION);
    expect(r.coaching.insights).toHaveLength(1);
    expect(r.coaching.insights[0]!.evidenceIds[0]).toMatch(/^deep-/);
    expect(r.coaching.drills).toHaveLength(6);
    expect(r.coaching.drills![1]!.area).toBe("utility");
    expect(r.coaching.deep?.utility).toBeDefined();
    expect(coachingSchema.safeParse(r.coaching).success).toBe(true);
  });

  it("quick reviews stay v6, cap moments at 6 and drills at 4, and cannot cite deep facts", async () => {
    const a = analysis();
    const focus = a.players[0]!.steamId;
    const fetch = provider((data) => {
      const facts = data.facts as { id: string }[];
      expect(facts.some((f) => f.id.startsWith("deep-"))).toBe(false);
      const candidates = data.momentCandidates as { id: string }[];
      return {
        verdict: "Quick.",
        summary: "S.",
        insights: [
          {
            observation: "O.",
            evidenceIds: [facts[0]!.id],
            confidence: "low",
            actionablePractice: "P.",
            caveats: [],
            kind: "improve",
            scope: "general",
          },
        ],
        keyMoments: candidates.slice(0, 9).map((c) => ({
          eventId: c.id,
          title: "T",
          whatHappened: "W.",
          whatToDoInstead: "I.",
          kind: "mistake",
          scope: "general",
        })),
        drills: Array.from({ length: 6 }, (_, i) => ({
          name: `D${i}`,
          durationMinutes: 10,
          howTo: "H.",
          metric: "M.",
          scope: "general",
        })),
        plan: [],
      };
    });
    const r = await aiCoaching(a, config(), { focusSteamId: focus, fetch });
    expect(r.coaching.tier).toBe("quick");
    expect(r.coaching.provenance?.promptVersion).toBe(
      POST_MATCH_PROMPT_VERSION,
    );
    expect(r.coaching.keyMoments!.length).toBeLessThanOrEqual(6);
    expect(r.coaching.drills).toHaveLength(4);
    expect(r.coaching.deep).toBeUndefined();
  });

  it("refuses a deep review without the deep modules", async () => {
    const a = analysis();
    await expect(
      aiCoaching(a, config(), {
        focusSteamId: a.players[0]!.steamId,
        tier: "deep",
        fetch: provider(() => ({})),
      }),
    ).rejects.toThrow(/deep modules/);
  });
});

describe("monthly report", () => {
  it("aggregates the period deterministically and adds one AI narrative", async () => {
    const a = analysis();
    const steamId = a.players[0]!.steamId;
    const match = (id: string, createdAt: string) => ({
      id,
      filename: `${id}.dem`,
      createdAt,
      analysis: a,
    });
    const deep = computeDeep(a, steamId).deep;
    const report = buildMonthlyReport({
      period: "2026-10",
      steamId,
      matches: [
        match("m1", "2026-10-02T10:00:00Z"),
        match("m2", "2026-10-09T10:00:00Z"),
      ],
      previousMatches: [match("m0", "2026-09-20T10:00:00Z")],
      deepReviews: [
        { analysisId: "m2", createdAt: "2026-10-09T11:00:00Z", deep },
      ],
    });
    expect(report.matches).toBe(2);
    expect(report.trends.find((t) => t.key === "adr")!.series).toHaveLength(2);
    expect(report.maps[0]!.matches).toBe(2);
    expect(report.best?.analysisId).toBeDefined();
    expect(monthlyReportSchema.safeParse(report).success).toBe(true);
    const sent: Body[] = [];
    const r = await aiMonthlyReport(
      report,
      config(),
      "pt",
      provider(
        () => ({
          headline: "Mês sólido",
          summary: "Resumo.",
          strengths: ["A"],
          focus: ["B"],
          plan: ["C", "D"],
        }),
        sent,
      ),
    );
    expect(sent[0]!.messages[0]!.content).toContain("MONTHLY");
    expect(sent[0]!.messages[0]!.content).toContain("Brazilian Portuguese");
    expect(r.report.narrative).toMatchObject({
      headline: "Mês sólido",
      plan: ["C", "D"],
    });
    expect(
      buildMonthlyReport({
        period: "2026-10",
        steamId: null,
        matches: [],
        previousMatches: [],
        deepReviews: [],
      }).caveats.length,
    ).toBeGreaterThan(0);
  });
});

describe("match reel", () => {
  it("orders the best highlights and clearest mistakes by match time", async () => {
    const { matchReel } = await import("./index.js");
    const a = analysis();
    const steamId = a.players[0]!.steamId;
    const reel = matchReel(a, steamId, { highlights: 3, mistakes: 2 });
    expect(reel.clips.length).toBeGreaterThan(0);
    expect(
      reel.clips.filter((c) => c.kind === "highlight").length,
    ).toBeLessThanOrEqual(3);
    expect(
      reel.clips.filter((c) => c.kind === "mistake").length,
    ).toBeLessThanOrEqual(2);
    for (let i = 1; i < reel.clips.length; i++)
      expect(
        reel.clips[i]!.round * 1000 + reel.clips[i]!.from,
      ).toBeGreaterThanOrEqual(
        reel.clips[i - 1]!.round * 1000 + reel.clips[i - 1]!.from,
      );
    expect(reel.totalSeconds).toBeGreaterThan(0);
    expect(reel.clips[0]!.title).toMatch(/^Round \d+: /);
  });
});
