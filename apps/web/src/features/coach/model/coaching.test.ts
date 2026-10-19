import { describe, expect, it } from "vitest";
import { mockCoaching } from "@/features/replay";
import {
  byScope,
  normalizeCoaching,
  overallScore,
  parseClip,
} from "./coaching";

describe("coach review normalisation", () => {
  it("reads the v5 fields: verdict, scores, key moments, drills, scoped plan", () => {
    const r = normalizeCoaching(mockCoaching());
    expect(r.verdict).toBe("Sharp aim, lonely entries.");
    expect(r.scores.map((s) => s.key)).toEqual([
      "aim",
      "positioning",
      "utility",
      "trading",
      "economy",
      "impact",
    ]);
    expect(overallScore(r.scores)).toBe(57);
    expect(r.keyMoments[0]).toMatchObject({
      kind: "highlight",
      round: 3,
      clip: { round: 3, from: 10, to: 24, at: 17.2 },
    });
    expect(byScope(r.insights).map.map((i) => i.observation)).toHaveLength(1);
    expect(r.plan.filter((p) => p.scope === "map")[0]?.map).toBe("de_mirage");
    expect(r.drills[2]).toMatchObject({ durationMinutes: 5, scope: "general" });
    expect(r.insights[0]!.clips).toHaveLength(1);
  });
  it("degrades gracefully for old reviews and junk", () => {
    const old = normalizeCoaching({
      summary: "Old summary",
      plan: ["Trade more"],
      insights: [
        {
          observation: "x",
          evidenceIds: ["e"],
          confidence: "high",
          actionablePractice: "y",
          caveats: [],
        },
        { observation: "" },
      ],
      caveats: [],
    });
    expect(old).toMatchObject({
      summary: "Old summary",
      scores: [],
      keyMoments: [],
      drills: [],
      plan: [{ text: "Trade more", scope: "general" }],
    });
    expect(old.insights).toHaveLength(1);
    expect(old.insights[0]).toMatchObject({
      kind: "improve",
      scope: "general",
      clips: [],
    });
    expect(normalizeCoaching(null).insights).toEqual([]);
    expect(
      normalizeCoaching({
        scores: { aim: { value: "NaN" }, luck: 90, impact: 140 },
      }).scores,
    ).toEqual([{ key: "impact", value: 100 }]);
    expect(overallScore([])).toBeNull();
  });
  it("validates clips and caps them at 40 seconds", () => {
    expect(parseClip({ round: 2, at: 30 })).toEqual({
      round: 2,
      from: 24,
      to: 36,
      at: 30,
    });
    expect(parseClip({ round: 2, from: 0, to: 90 })).toEqual({
      round: 2,
      from: 0,
      to: 40,
    });
    expect(parseClip({ round: 0, from: 1, to: 2 })).toBeUndefined();
    expect(parseClip({ round: 1, from: 5, to: 2 })).toBeUndefined();
  });
});
