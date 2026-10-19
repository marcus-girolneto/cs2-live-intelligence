import { describe, expect, it } from "vitest";
import { teamScore } from "./progress.service.js";

describe("teamScore", () => {
  it("counts rounds won and lost from the player's team view", () => {
    expect(teamScore([{ won: true }, { won: false }, { won: true }])).toEqual({
      roundsWon: 2,
      roundsLost: 1,
    });
  });
  it("is unknown when any round lacks a result or there are no rounds", () => {
    expect(teamScore([{ won: true }, {}])).toEqual({
      roundsWon: null,
      roundsLost: null,
    });
    expect(teamScore([])).toEqual({ roundsWon: null, roundsLost: null });
    expect(teamScore(undefined)).toEqual({ roundsWon: null, roundsLost: null });
  });
});
