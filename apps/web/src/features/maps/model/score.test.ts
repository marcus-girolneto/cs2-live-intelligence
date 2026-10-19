import { describe, expect, it } from "vitest";
import { finalScore, formatScore } from "./score";

describe("final score", () => {
  it("formats won–lost when both are finite", () => {
    expect(formatScore({ roundsWon: 13, roundsLost: 9 })).toBe("13–9");
    expect(finalScore({ roundsWon: 0, roundsLost: 13 })).toEqual({
      won: 0,
      lost: 13,
    });
  });
  it("is null when unknown", () => {
    expect(formatScore({ roundsWon: 13, roundsLost: null })).toBeNull();
    expect(formatScore({})).toBeNull();
    expect(formatScore(undefined)).toBeNull();
    expect(formatScore({ roundsWon: Number.NaN, roundsLost: 2 })).toBeNull();
  });
});
