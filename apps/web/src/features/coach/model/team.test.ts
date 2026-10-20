import { describe, expect, it } from "vitest";
import { normalizeTeamReview, normalizeTeamReviews } from "./team";

const RAW = {
  schemaVersion: "1.0",
  members: ["1", "2"],
  verdict: "You lose the fights after the first kill.",
  teamScores: {
    trading: { value: 41, label: "below", basis: "12 of 29 deaths traded" },
    utility: { value: 140, label: "elite", basis: "x" },
    economy: { value: "bad" },
  },
  roles: [
    {
      steamId: "1",
      role: "entry",
      strengths: [{ text: "Wins openings", evidenceIds: ["team-1"] }],
      fixes: [{ text: "Wait for the flash", evidenceIds: [] }],
    },
    { role: "support" },
  ],
  patterns: [{ text: "Late rotations", confidence: "high", clips: [] }],
  keyRounds: [
    {
      round: 7,
      title: "Lost 4v2",
      whatHappened: "Split up",
      whatToDoInstead: "Group",
    },
    { title: "no round" },
  ],
  plan: [{ text: "Trade within 2 s", owner: "team" }, { owner: "1" }],
  caveats: ["Small sample"],
};

describe("team review", () => {
  it("normalizes and clamps defensively", () => {
    const r = normalizeTeamReview(RAW)!;
    expect(r.scores.map((s) => [s.key, s.value])).toEqual([
      ["trading", 41],
      ["utility", 100],
    ]);
    expect(r.roles).toHaveLength(1);
    expect(r.roles[0]!.fixes[0]!.text).toBe("Wait for the flash");
    expect(r.keyRounds).toHaveLength(1);
    expect(r.plan).toEqual([{ text: "Trade within 2 s", owner: "team" }]);
    expect(r.patterns[0]!.confidence).toBe("high");
    expect(normalizeTeamReview({})).toBeNull();
  });
  it("lists stored reviews newest first", () => {
    const list = normalizeTeamReviews({
      reviews: [
        { reviewId: "a", createdAt: "2026-10-01T00:00:00Z", teamReview: RAW },
        { reviewId: "b", createdAt: "2026-10-05T00:00:00Z", teamReview: RAW },
        { reviewId: "c", teamReview: {} },
      ],
    });
    expect(list.map((x) => x.id)).toEqual(["b", "a"]);
  });
});
