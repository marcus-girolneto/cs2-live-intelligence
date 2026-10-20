import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  categoryOf,
  heightBandOf,
  onTargetPct,
  summarizeCrosshair,
  type CrosshairDuel,
} from "./crosshair.js";

/** 15 measured duels of a real public demo (deep review of one player). */
const duels = JSON.parse(
  readFileSync(
    new URL("../fixtures/crosshair-duels.json", import.meta.url),
    "utf8",
  ),
) as CrosshairDuel[];

describe("crosshair in player terms", () => {
  it("sorts real duels into on target, close and off", () => {
    const s = summarizeCrosshair(duels);
    expect(s.preAim).toEqual({ onTarget: 3, close: 5, off: 7, total: 15 });
    expect(onTargetPct(duels)).toBe(20);
    // 1.7 degrees at 1182 units is about 35 units: one small adjustment.
    expect(
      categoryOf({
        offset: 1.7,
        pitchError: -1.4,
        yawOffset: 0.9,
        distance: 1182,
      }),
    ).toBe("close");
    // Close duels are more forgiving: 4.7 degrees at 150 units is still on the enemy.
    expect(
      categoryOf({ offset: 4.7, pitchError: 0, yawOffset: 4.7, distance: 150 }),
    ).toBe("on");
    expect(
      categoryOf({
        offset: 34.8,
        pitchError: 0.2,
        yawOffset: 34.8,
        distance: 1377,
      }),
    ).toBe("off");
  });
  it("finds the typical height and the worst callouts", () => {
    const s = summarizeCrosshair(duels);
    expect(s.heightBand).toBe("neck");
    expect(s.horizontalBias).toBeNull();
    expect(s.perCallout).toEqual([
      { callout: "CTSpawn", onTarget: 1, total: 5 },
      { callout: "PalaceInterior", onTarget: 1, total: 4 },
      { callout: "BombsiteA", onTarget: 1, total: 3 },
    ]);
    expect(s.dots).toHaveLength(15);
    expect(s.dots.every((d) => d.y <= 3 && d.y >= -6)).toBe(true);
  });
  it("maps vertical offsets to body heights", () => {
    expect([10, 0, -8, -20, -30, -50].map(heightBandOf)).toEqual([
      "above",
      "head",
      "neck",
      "chest",
      "stomach",
      "legs",
    ]);
  });
  it("detects a side drift only when most duels agree", () => {
    const right = Array.from({ length: 6 }, () => ({
      offset: 3,
      pitchError: 0,
      yawOffset: 3,
      yawError: 3,
      distance: 600,
    }));
    expect(summarizeCrosshair(right).horizontalBias).toBe("right");
    const mixed = right.map((d, i) => ({ ...d, yawError: i % 2 ? 3 : -3 }));
    expect(summarizeCrosshair(mixed).horizontalBias).toBe("centered");
  });
});
