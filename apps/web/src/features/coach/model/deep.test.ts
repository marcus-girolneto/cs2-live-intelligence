import { describe, expect, it } from "vitest";
import { normalizeCoaching } from "./coaching";
import { compareReviews } from "./compare";
import { nadeType, normalizeDeep, trendOf } from "./deep";
import { DEEP_SAMPLE } from "./deepSample";

const deepRaw = {
  utility: {
    efficiency: 0.62,
    grenades: [
      {
        round: 3,
        type: "flashbang",
        landing: { x: 10, y: 20 },
        verdict: "wasted",
        clip: { round: 3, from: 10, to: 20 },
      },
      { round: 4, grenade: "smokegrenade", landing: [5, 5] },
      { round: 5, type: "banana" },
    ],
    perType: {
      flash: { thrown: 4, effective: 1 },
      smoke: { thrown: 3, efficiency: 80 },
    },
    lineups: [
      { title: "Window smoke from T spawn", type: "smoke" },
      { why: "no title" },
    ],
  },
  crosshair: {
    medianOffset: 4.2,
    samples: [
      {
        offset: 0.5,
        pitchError: -0.2,
        yawOffset: 0.4,
        distance: 900,
        won: true,
      },
      {
        offset: 3,
        pitchError: -1,
        yawOffset: 2.8,
        distance: 700,
        place: "BombsiteA",
      },
      {
        offset: 30,
        pitchError: 2,
        yawOffset: 29,
        distance: 1200,
        place: "BombsiteA",
      },
    ],
  },
  positioning: {
    isolation: 45,
    crossfire: 20,
    dangerZones: [{ place: "Connector", deaths: 3, rounds: [2, 5, "x"] }],
  },
  rounds: [
    { round: 2, side: "T", outcome: "loss", kills: 1, tags: ["eco"] },
    { round: 1, side: "CT", won: true },
    { round: 0 },
  ],
  history: [
    {
      key: "offset",
      label: "Pre-aim offset",
      current: 4.2,
      baseline: 5,
      unit: "°",
      better: "lower",
    },
    { label: "bad" },
  ],
};

describe("deep review", () => {
  it("normalizes every deep section defensively", () => {
    const d = normalizeDeep(deepRaw)!;
    expect(d.utility!.efficiency).toBe(62);
    expect(d.utility!.throws.map((x) => x.type)).toEqual(["flash", "smoke"]);
    expect(d.utility!.throws[1]!.landing).toEqual({ x: 5, y: 5 });
    expect(d.utility!.throws[0]!.clip?.round).toBe(3);
    expect(d.utility!.perType.map((s) => s.type)).toEqual(["flash", "smoke"]);
    expect(d.utility!.lineups).toHaveLength(1);
    // Degrees never reach the page: the section is built from the measured duels.
    expect(d.crosshair).toMatchObject({
      preAim: { onTarget: 1, close: 1, off: 1, total: 3 },
    });
    expect(JSON.stringify(d.crosshair)).not.toMatch(/°|offset|pitch/i);
    expect(d.positioning!.zones[0]!.rounds).toEqual([2, 5]);
    expect(d.rounds.map((r) => [r.round, r.won])).toEqual([
      [1, true],
      [2, false],
    ]);
    expect(d.history).toHaveLength(1);
    expect(trendOf(d.history[0]!)).toBe("better");
  });
  it("returns undefined for empty or junk input", () => {
    expect(normalizeDeep(null)).toBeUndefined();
    expect(
      normalizeDeep({ utility: {}, crosshair: {}, rounds: "x" }),
    ).toBeUndefined();
    expect(nadeType("Incendiary Grenade")).toBe("molotov");
  });
  it("reads the tier from the coaching payload", () => {
    expect(normalizeCoaching({ tier: "quick" }).tier).toBe("quick");
    expect(normalizeCoaching({ deep: deepRaw }).tier).toBe("deep");
    expect(normalizeCoaching({}).tier).toBeNull();
    expect(DEEP_SAMPLE.utility).toBeDefined();
  });
  it("compares quick and deep reviews", () => {
    const quick = normalizeCoaching({
      tier: "quick",
      scores: { aim: 60, utility: 40 },
      insights: [{ observation: "a" }],
      keyMoments: [{ title: "m1" }],
    });
    const deep = normalizeCoaching({
      tier: "deep",
      scores: { aim: 64, utility: 30 },
      insights: [{ observation: "a" }, { observation: "b" }],
      keyMoments: [{ title: "m1" }, { title: "m2" }, { title: "m3" }],
      deep: deepRaw,
    });
    const c = compareReviews(quick, deep);
    expect(c.overall).toEqual({ quick: 50, deep: 47 });
    expect(c.insights).toEqual({ quick: 1, deep: 2 });
    expect(c.extras.map((x) => x.key)).toEqual([
      "utility",
      "crosshair",
      "positioning",
      "rounds",
      "moments",
    ]);
    expect(c.extras.find((x) => x.key === "moments")!.n).toBe(2);
  });
});
