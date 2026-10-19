import { describe, expect, it } from "vitest";
import type { AiConfig } from "@cs2/coaching";
import { PersonalCoachService } from "../../src/modules/personal-coach/personal-coach.service.js";
import type {
  CoachPlanRecord,
  NewCoachPlan,
  PersonalCoachRepository,
} from "../../src/modules/personal-coach/personal-coach.repository.js";
import { ViewerPolicy } from "../../src/modules/coaching/viewer.policy.js";
import { ZonedClock } from "../../src/shared/clock/clock.js";
import { silentLogger } from "../../src/shared/logging/logger.js";
import { analysisWith, appError } from "./fakes.js";

class FakePlans implements PersonalCoachRepository {
  saved: (NewCoachPlan & { id: string })[] = [];
  async save(p: NewCoachPlan) {
    this.saved.unshift({ ...p, id: `p${this.saved.length + 1}` });
    return this.saved[0]!.id;
  }
  async history(): Promise<CoachPlanRecord[]> {
    return this.saved.map((p) => ({
      id: p.id,
      lang: p.lang,
      trigger: p.trigger,
      plan: p.plan,
      basedOnMatches: p.plan.basedOnMatches,
      lastAnalysisAt: p.lastAnalysisAt,
      provider: p.provider,
      model: p.model,
      createdAt: p.createdAt,
    }));
  }
}

function setup(pro = true) {
  let now = Date.parse("2026-10-19T12:00:00Z");
  const analyses = [
    {
      id: "a1",
      createdAt: "2026-10-10T00:00:00.000Z",
      analysis: analysisWith(["p1"]),
    },
  ];
  const plans = new FakePlans();
  const calls: string[] = [];
  const service = new PersonalCoachService(
    plans,
    {
      playerSteamId: async () => "p1",
      completedAnalyses: async () => analyses,
      reviews: async () => [
        {
          createdAt: "2026-10-01T00:00:00.000Z",
          rating: 5,
          planItems: [{ text: "Trade more" }],
        },
      ],
      deepReviews: async () => [],
      liveCalls: async () => 2,
      enabled: async () => pro,
      settings: async () => ({
        personalCoachIntervalDays: 7,
        personalCoachNewMatches: 3,
      }),
    },
    {
      acquire: async (_o, purpose) => (
        calls.push(purpose),
        { provider: "x", model: "m" } as AiConfig
      ),
    },
    {
      personalCoach: async (aggregates, _c, lang, generatedAt) => ({
        plan: {
          schemaVersion: "1.0" as const,
          promptVersion: "personal-coach-v1",
          headline: `H-${lang}`,
          workingWell: [],
          notWorking: [],
          focusAreas: [],
          weeklyProgram: [],
          perMap: [],
          nextReviewSuggestion: "",
          generatedAt,
          basedOnMatches: aggregates.basedOnMatches,
          facts: aggregates.facts,
          caveats: [],
        },
        call: {
          provider: "vendor",
          model: "secret",
          latencyMs: 1,
          attempts: 1,
        },
      }),
    },
    new ZonedClock("UTC", () => now),
    silentLogger,
  );
  return { service, plans, calls, analyses, tick: (ms: number) => (now += ms) };
}
const user = ViewerPolicy.for(false);

describe("PersonalCoachService", () => {
  it("402 plan_required with counts only for non-Pro accounts", async () => {
    const { service } = setup(false);
    expect(await appError(service.view("o", user))).toMatchObject({
      status: 402,
      body: {
        code: "plan_required",
        teaser: { analyzedMatches: 1, reviews: 1, plansGiven: 1 },
      },
    });
  });
  it("generates with the personal_coach purpose, hides the model and enforces the cooldown", async () => {
    const s = setup();
    const view = await s.service.generate("o", "pt", user);
    expect(s.calls).toEqual(["personal_coach"]);
    expect(view.latest).toMatchObject({
      trigger: "manual",
      plan: { headline: "H-pt", basedOnMatches: 1 },
    });
    expect(view.latest!.provider).toBeUndefined();
    expect(view.nextAvailableAt).toBe("2026-10-26T12:00:00.000Z");
    expect(await appError(s.service.generate("o", "en", user))).toMatchObject({
      status: 429,
      body: { code: "personal_coach_cooldown", newMatchesNeeded: 3 },
    });
    s.tick(8 * 86_400_000);
    expect((await s.service.generate("o", "en", user)).history).toHaveLength(2);
  });
  it("auto-regenerates only after enough new analyses", async () => {
    const s = setup();
    expect(await s.service.autoRegenerate("o", user)).toBe(false);
    await s.service.generate("o", "pt", user);
    expect(await s.service.autoRegenerate("o", user)).toBe(false);
    for (let i = 2; i <= 4; i++)
      s.analyses.push({
        id: `a${i}`,
        createdAt: `2026-10-1${i}T00:00:00.000Z`,
        analysis: analysisWith(["p1"]),
      });
    s.tick(60_000);
    expect(await s.service.autoRegenerate("o", user)).toBe(true);
    expect(s.plans.saved[0]).toMatchObject({ trigger: "auto", lang: "pt" });
  });
});
