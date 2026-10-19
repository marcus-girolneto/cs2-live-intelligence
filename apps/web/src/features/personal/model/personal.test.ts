import { describe, expect, it } from "vitest";
import {
  coolingDown,
  EMPTY_PERSONAL,
  focusProgress,
  generateErrorMessage,
  normalizePersonal,
  teaserFrom,
} from "./personal";

describe("normalizePersonal", () => {
  it("maps the envelope defensively", () => {
    const s = normalizePersonal({
      latest: {
        headline: "Trade more",
        workingWell: [
          { text: "Opening duels", evidence: ["58% won", "12 matches"] },
          "Utility",
        ],
        notWorking: [
          { text: "Isolated deaths", evidence: "47%" },
          { evidence: "x" },
        ],
        focusAreas: [
          {
            area: "Trading",
            why: "Untraded deaths",
            targetMetric: "Traded %",
            current: 29,
            target: 45,
          },
          { area: "Pre-aim", targetMetric: "Offset °", current: 6, target: 4 },
          { area: "Nothing" },
        ],
        weeklyProgram: [
          {
            week: 2,
            goals: ["B"],
            drills: [{ name: "Prefire", minutesPerDay: 10 }],
          },
          { week: 1, goals: "A", drills: ["Deathmatch"] },
          { week: 3 },
        ],
        perMap: [
          { map: "de_mirage", notes: "Window smoke" },
          { map: "de_nuke", notes: [] },
        ],
        generatedAt: "2026-10-18T12:00:00Z",
        basedOnMatches: 12,
      },
      history: [{ id: "p1", headline: "Old", generatedAt: "bad" }, { nope: 1 }],
      nextAllowedAt: "2026-10-20T00:00:00Z",
    });
    const p = s.latest!;
    expect(p.workingWell).toEqual([
      { text: "Opening duels", evidence: "58% won · 12 matches" },
      { text: "Utility", evidence: null },
    ]);
    expect(p.notWorking).toHaveLength(1);
    expect(p.focusAreas.map((f) => f.progress)).toEqual([64, 67, null]);
    expect(p.weeklyProgram.map((w) => w.week)).toEqual([1, 2]);
    expect(p.weeklyProgram[0]!.drills[0]).toMatchObject({
      id: "w1-0",
      name: "Deathmatch",
      minutesPerDay: null,
    });
    expect(p.perMap).toEqual([{ map: "de_mirage", notes: ["Window smoke"] }]);
    expect(p.basedOnMatches).toBe(12);
    expect(s.history).toEqual([
      { id: "p1", generatedAt: null, headline: "Old" },
    ]);
    expect(coolingDown(s, Date.parse("2026-10-19T00:00:00Z"))).toBe(true);
    expect(coolingDown(s, Date.parse("2026-10-21T00:00:00Z"))).toBe(false);
  });

  it("handles empty or plan-only payloads", () => {
    expect(normalizePersonal(null)).toEqual(EMPTY_PERSONAL);
    expect(normalizePersonal({ latest: { headline: "" } }).latest).toBeNull();
    expect(normalizePersonal({ headline: "Direct" }).latest?.headline).toBe(
      "Direct",
    );
  });

  it("measures progress in both directions", () => {
    expect(focusProgress(50, 50)).toBe(100);
    expect(focusProgress(null, 3)).toBeNull();
    expect(focusProgress(0, 0)).toBe(100);
    expect(focusProgress(10, 0)).toBe(0);
  });
  it("reads the PersonalCoachDto envelope and resolves cited fact ids", () => {
    const s = normalizePersonal({
      latest: {
        id: "pc1",
        createdAt: "2026-10-18T12:00:00Z",
        trigger: "manual",
        plan: {
          schemaVersion: "1.0",
          headline: "Trade more",
          workingWell: [{ text: "Entries", evidence: ["open_ct", "ghost"] }],
          notWorking: [{ text: "Isolated", evidence: ["traded"] }],
          focusAreas: [
            {
              area: "Trading",
              why: "w",
              targetMetric: "traded",
              current: 29,
              target: 45,
            },
          ],
          weeklyProgram: [],
          perMap: [{ map: "de_mirage", notes: "Window smoke" }],
          nextReviewSuggestion: "Later",
          generatedAt: "nope",
          basedOnMatches: 12,
          facts: [
            {
              id: "open_ct",
              label: "Opening duels won",
              value: 58,
              unit: "%",
              trend: 2,
              better: "higher",
              matches: 12,
            },
            {
              id: "traded",
              label: "Traded deaths",
              value: 29.44,
              unit: "%",
              trend: null,
              better: "higher",
              matches: 12,
              map: "de_mirage",
            },
          ],
          caveats: ["Few deep reviews."],
        },
      },
      history: [
        {
          id: "pc1",
          createdAt: "2026-10-18T12:00:00Z",
          headline: "Trade more",
          basedOnMatches: 12,
        },
      ],
      analyzedMatches: 14,
      newMatchesSinceLast: 2,
      nextAvailableAt: "2026-10-25T00:00:00Z",
      autoRegenerateAfterMatches: 5,
    });
    const p = s.latest!;
    expect(p.workingWell[0]!.evidence).toBe("Opening duels won: 58%");
    expect(p.notWorking[0]!.evidence).toBe("Traded deaths: 29.4% (de_mirage)");
    expect(p.focusAreas[0]!.targetMetric).toBe("Traded deaths");
    expect(p.generatedAt).toBe("2026-10-18T12:00:00Z");
    expect(p.caveats).toEqual(["Few deep reviews."]);
    expect(s).toMatchObject({
      nextAllowedAt: "2026-10-25T00:00:00Z",
      analyzedMatches: 14,
      newMatchesSinceLast: 2,
      autoRegenerateAfterMatches: 5,
    });
    expect(s.history[0]!.generatedAt).toBe("2026-10-18T12:00:00Z");
  });
  it("reads the 402 teaser and explains generate errors", () => {
    expect(
      teaserFrom({
        status: 402,
        body: {
          code: "plan_required",
          teaser: { analyzedMatches: 12, reviews: 3, plansGiven: 2 },
        },
      }),
    ).toEqual({ analyzedMatches: 12, reviews: 3, plansGiven: 2 });
    expect(teaserFrom({ status: 500, body: {} })).toBeNull();
    expect(generateErrorMessage({ code: "personal_coach_cooldown" })).toMatch(
      /recently/,
    );
    expect(generateErrorMessage({ code: "x" })).toBeNull();
  });
});
