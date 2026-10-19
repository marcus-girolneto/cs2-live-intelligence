import { describe, expect, it } from "vitest";
import { describeEvent } from "./evidence";
describe("auditable source event rendering", () => {
  it("preserves round, tick, actors and damage in evidence detail", () => {
    expect(
      describeEvent({
        id: "d",
        type: "damage",
        round: 2,
        tick: 100,
        attackerId: "a",
        victimId: "b",
        healthDamage: 42,
      }),
    ).toBe("Tick 100 · round 2 · damage · a → b · health damage 42");
  });
  it("labels world attribution and missing round winner explicitly", () => {
    expect(
      describeEvent({
        id: "k",
        type: "kill",
        round: 3,
        tick: 201,
        victimId: "b",
        headshot: false,
      }),
    ).toContain("World / unavailable → b · headshot no");
    expect(
      describeEvent({ id: "r", type: "round_end", round: 4, tick: 500 }),
    ).toContain("winner Not available");
  });
});
