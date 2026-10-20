import { describe, expect, it } from "vitest";
import { sanitizePayload } from "./security.js";

describe("callouts sent to the model", () => {
  it("are readable in place fields and in data sentences", () => {
    expect(
      sanitizePayload({
        place: "TopofMid",
        fromPlace: "CTSpawn",
        worstCallouts: ["SnipersNest"],
        description: "3 deaths at BombsiteA, 0 traded",
        id: "deep-pos-topofmid",
      }),
    ).toEqual({
      place: "Top of Mid",
      fromPlace: "CT Spawn",
      worstCallouts: ["Sniper's Nest"],
      description: "3 deaths at Bombsite A, 0 traded",
      id: "deep-pos-topofmid",
    });
  });
});
