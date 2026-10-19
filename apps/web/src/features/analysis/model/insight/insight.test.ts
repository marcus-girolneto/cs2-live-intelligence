import { describe, expect, it } from "vitest";
import type { Analysis, DemoEvent } from "@cs2/contracts";
import { playerInsight } from "./index";

type Player = Analysis["players"][number];
const metric = (value: number | null) => ({
  value,
  numerator: 0,
  denominator: 0,
  complete: value !== null,
  formula: "",
  evidenceIds: [],
});
const base: Player = {
  steamId: "me",
  kills: metric(2),
  deaths: metric(1),
  adr: metric(80),
  headshotPercentage: metric(50),
};

describe("player insight", () => {
  it("returns explicit nulls for basic analyses", () => {
    const i = playerInsight(base, []);
    expect(i.rich).toBe(false);
    expect(i.accuracy).toBeNull();
    expect(i.hitgroups).toBeNull();
    expect(i.weapons).toEqual([]);
  });
  it("prefers detail and the analytics accuracy metric", () => {
    const i = playerInsight(
      {
        ...base,
        advanced: { accuracy: metric(39.2) },
        detail: {
          shots: 74,
          hits: 29,
          hitgroups: { head: 5, chest: 10, left_leg: 1, right_arm: 2 },
          weapons: [
            {
              weapon: "AWP",
              kills: 6,
              headshots: 1,
              damage: 550,
              shots: 13,
              hits: 6,
            },
            {
              weapon: "Smoke Grenade",
              kills: 0,
              headshots: 0,
              damage: 0,
              shots: 0,
              hits: 0,
            },
          ],
        },
      },
      [],
    );
    expect(i.accuracy).toBe(39.2);
    expect(i.hitgroups).toEqual({
      head: 5,
      chest: 10,
      stomach: 0,
      arms: 2,
      legs: 1,
    });
    expect(i.hitTotal).toBe(18);
    expect(i.weapons).toHaveLength(1);
    expect(i.weapons[0]!.name).toBe("AWP");
  });
  it("derives breakdowns from enriched events when detail is missing", () => {
    const events: DemoEvent[] = [
      {
        id: "s1",
        tick: 1,
        round: 1,
        type: "shot",
        shooterId: "me",
        weapon: "AK-47",
      },
      {
        id: "s2",
        tick: 2,
        round: 1,
        type: "shot",
        shooterId: "me",
        weapon: "AK-47",
      },
      {
        id: "d1",
        tick: 2,
        round: 1,
        type: "damage",
        attackerId: "me",
        victimId: "x",
        healthDamage: 100,
        weapon: "AK-47",
        hitgroup: "head",
      },
      {
        id: "k1",
        tick: 2,
        round: 1,
        type: "kill",
        attackerId: "me",
        victimId: "x",
        headshot: true,
        weapon: "AK-47",
        attackerPlace: "TopofMid",
        attackerPos: { x: 1, y: 2, z: 0 },
        victimPos: { x: 5, y: 6, z: 0 },
        roundTime: 12,
      },
      {
        id: "k2",
        tick: 9,
        round: 1,
        type: "kill",
        attackerId: "y",
        victimId: "me",
        headshot: false,
        victimPlace: "BombsiteA",
        victimPos: { x: 3, y: 3, z: 0 },
        roundTime: 15,
      },
    ];
    const i = playerInsight(base, events);
    expect(i.shots).toBe(2);
    expect(i.accuracy).toBe(50);
    expect(i.hitgroups?.head).toBe(1);
    expect(i.weapons[0]).toMatchObject({
      name: "AK-47",
      kills: 1,
      headshots: 1,
    });
    expect(i.places.map((p) => p.place).sort()).toEqual([
      "BombsiteA",
      "TopofMid",
    ]);
    expect(i.markers).toHaveLength(2);
    expect(i.timing?.earlyDeaths).toBe(1);
    expect(i.timing?.avgOpeningTime).toBe(12);
  });
});
