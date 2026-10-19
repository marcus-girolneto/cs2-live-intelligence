import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { analyzeDemo } from "@cs2/analytics";
import { personalCoachPlanSchema } from "@cs2/contracts";
import {
  aiPersonalCoach,
  buildCoachAggregates,
  buildPersonalPlan,
  computeDeep,
  loadAiConfig,
  PERSONAL_COACH_PROMPT_VERSION,
} from "./index.js";

const analysis = analyzeDemo(
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
const steamId = analysis.players[0]!.steamId;
const history = () => ({
  steamId,
  analyses: ["2026-09-01", "2026-09-10", "2026-10-01", "2026-10-10"].map(
    (d, i) => ({
      id: `a${i}`,
      createdAt: `${d}T10:00:00.000Z`,
      analysis,
    }),
  ),
  deepReviews: [
    {
      analysisId: "a2",
      createdAt: "2026-10-01T11:00:00.000Z",
      deep: computeDeep(analysis, steamId).deep,
    },
  ],
  plans: [
    {
      createdAt: "2026-09-15T00:00:00.000Z",
      text: "Play for trades on T side",
    },
  ],
  ratings: [4, 5],
  liveCalls: 3,
});

describe("personal coach aggregates", () => {
  it("computes overall, per-map, deep, plan adherence and activity facts with stable ids", () => {
    const agg = buildCoachAggregates(history());
    const ids = agg.facts.map((f) => f.id);
    expect(ids).toContain("overall-adr");
    expect(ids.some((id) => id.startsWith("map-de-mirage-"))).toBe(true);
    expect(ids.some((id) => id.startsWith("deep-"))).toBe(true);
    expect(ids).toContain("plan-1-tradedDeaths");
    expect(agg.facts.find((f) => f.id === "reviews-rating")!.value).toBe(4.5);
    expect(agg.basedOnMatches).toBe(4);
    expect(new Set(ids).size).toBe(ids.length);
    expect(JSON.stringify(buildCoachAggregates(history()))).toBe(
      JSON.stringify(agg),
    );
    expect(buildCoachAggregates({ ...history(), analyses: [] }).facts).toEqual(
      [],
    );
  });
  it("drops items citing unknown ids and copies current values from the facts", () => {
    const agg = buildCoachAggregates(history());
    const { plan, dropped } = buildPersonalPlan(
      {
        headline: "Trade more",
        workingWell: [
          { text: "Good ADR", evidence: ["overall-adr"] },
          { text: "Fake", evidence: ["nope"] },
        ],
        notWorking: [],
        focusAreas: [
          {
            area: "Trading",
            why: "Few trades",
            targetMetric: "overall-tradedDeaths",
            target: 40,
          },
          { area: "Made up", why: "x", targetMetric: "invented", target: 1 },
        ],
        weeklyProgram: [
          {
            week: 1,
            goals: ["Trade"],
            drills: [
              { name: "Retakes", minutesPerDay: 2, howTo: "With a friend" },
            ],
          },
        ],
        perMap: [
          { map: "de_mirage", notes: "Mid control" },
          { map: "de_nuke", notes: "not played" },
        ],
        nextReviewSuggestion: "Deep review next match.",
      },
      agg,
      "2026-10-19T00:00:00.000Z",
    );
    expect(dropped).toBe(2);
    expect(plan.workingWell).toHaveLength(1);
    expect(plan.focusAreas[0]!.current).toBe(
      agg.facts.find((f) => f.id === "overall-tradedDeaths")?.value ?? null,
    );
    expect(plan.weeklyProgram[0]!.drills[0]!.minutesPerDay).toBe(5);
    expect(plan.perMap.map((m) => m.map)).toEqual(["de_mirage"]);
    expect(personalCoachPlanSchema.safeParse(plan).success).toBe(true);
  });
  it("makes one model call with the personal coach prompt", async () => {
    const r = loadAiConfig({
      AI_PROVIDER: "openrouter",
      AI_API_KEY: "k",
      AI_MODEL: "m",
    });
    if (!r.ok) throw new Error(r.reason);
    const sent: string[] = [];
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      sent.push(String(init.body));
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                headline: "H",
                workingWell: [],
                notWorking: [],
                focusAreas: [],
                weeklyProgram: [],
                perMap: [],
                nextReviewSuggestion: "N",
              }),
            },
          },
        ],
      });
    }) as unknown as typeof fetch;
    const out = await aiPersonalCoach(
      buildCoachAggregates(history()),
      r.config,
      "pt",
      "2026-10-19T00:00:00.000Z",
      fetchImpl,
    );
    expect(sent[0]).toContain("personal Counter-Strike 2 coach");
    expect(sent[0]).toContain("Brazilian Portuguese");
    expect(out.plan).toMatchObject({
      headline: "H",
      promptVersion: PERSONAL_COACH_PROMPT_VERSION,
      basedOnMatches: 4,
    });
  });
});
