import { describe, expect, it } from "vitest";
import { normalizeCoaching } from "./coaching";
import { strengthsOf, topFixes } from "./fixes";

describe("topFixes", () => {
  it("puts clear patterns first and tops up with mistake moments", () => {
    const c = normalizeCoaching({
      insights: [
        { observation: "Low one", kind: "improve", confidence: "low" },
        {
          observation: "You die alone",
          kind: "improve",
          confidence: "high",
          actionablePractice: "Stay near a teammate",
          whyItMatters: "Untraded deaths lose rounds",
        },
        { observation: "Great spray", kind: "strength" },
      ],
      keyMoments: [
        {
          round: 7,
          title: "Peeked alone",
          kind: "mistake",
          whatHappened: "You swung B alone",
          whatToDoInstead: "Wait for the flash",
        },
        { round: 3, title: "Ace", kind: "highlight" },
      ],
    });
    const fixes = topFixes(c);
    expect(fixes.map((f) => f.title)).toEqual([
      "You die alone",
      "Low one",
      "Peeked alone",
    ]);
    expect(fixes[0]).toMatchObject({
      why: "Untraded deaths lose rounds",
      todo: "Stay near a teammate",
      confidence: "clear",
    });
    expect(fixes[1]!.confidence).toBe("early");
    expect(fixes[2]).toMatchObject({ happened: "You swung B alone", round: 7 });
    expect(strengthsOf(c)).toEqual(["Great spray", "Ace"]);
  });
});
