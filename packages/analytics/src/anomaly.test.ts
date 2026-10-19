import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { Aim, NormalizedDemo } from "@cs2/contracts";
import {
  INTEGRITY_THRESHOLDS,
  angleDelta,
  binomialZ,
  integritySignals,
  snapOf,
} from "./anomaly.js";
import { analyzeDemo } from "./index.js";

const A = "76561198000000001";
const B = "76561198000000002";
const C = "76561198000000003";
const D = "76561198000000004";

/** 33 samples at 64 tick: still, then (optionally) a 40° flick within the last 2 ticks. */
function aim(flick: boolean, settleOffset = 0.2): Aim {
  const dt = Array.from({ length: 33 }, (_, i) => i - 32);
  const yaw = dt.map((t) =>
    flick ? (t <= -2 ? 100 : t === -1 ? 75 : 60) : 60 + (t + 32) * 0.05,
  );
  const target = flick ? 60 : 61.6;
  return {
    firstShotTick: 1000,
    dt,
    yaw,
    pitch: dt.map(() => 5),
    targetYaw: target + settleOffset,
    targetPitch: 2,
    bodyPitch: 9,
  };
}

function demo(options: {
  snaps?: number;
  plainAims?: number;
  hsKills?: number;
  bodyKills?: number;
}): NormalizedDemo {
  const events: NormalizedDemo["events"] = [];
  let n = 0;
  const id = () => `e${n++}`;
  const combat = (
    type: "kill" | "damage",
    attacker: string,
    victim: string,
    extra: Record<string, unknown> = {},
  ) => {
    const tick = 1000 + n * 200;
    const base = {
      id: id(),
      tick,
      round: 1,
      attackerId: attacker,
      victimId: victim,
      attackerTeam: attacker === A || attacker === C ? "CT" : "T",
      victimTeam: victim === A || victim === C ? "CT" : "T",
      ...extra,
    } as const;
    events.push(
      type === "kill"
        ? { ...base, type, headshot: false, ...extra }
        : { ...base, type, healthDamage: 30, ...extra },
    );
  };
  for (let i = 0; i < (options.snaps ?? 0); i++)
    combat("damage", A, B, { aim: aim(true) });
  for (let i = 0; i < (options.plainAims ?? 0); i++)
    combat("damage", A, B, { aim: aim(false) });
  for (let i = 0; i < (options.hsKills ?? 0); i++)
    combat("kill", A, B, { headshot: true });
  for (let i = 0; i < (options.bodyKills ?? 0); i++) {
    combat("kill", A, D, { headshot: false });
    combat("kill", B, C, { headshot: i % 4 === 0 });
    combat("kill", C, D, { headshot: i % 3 === 0 });
    combat("kill", D, A, { headshot: i % 5 === 0 });
  }
  return {
    schemaVersion: "1.0",
    parserVersion: "test+cs2live.5",
    complete: true,
    completeness: { kills: true, damage: true, rounds: true },
    tickRate: 64,
    players: [A, B, C, D].map((steamId) => ({ steamId })),
    rounds: [{ number: 1, participants: [A, B, C, D] }],
    events,
  };
}

describe("integrity signals", () => {
  it("measures snap speed, travel and how exactly the crosshair settled", () => {
    const snap = snapOf(aim(true), 64)!;
    expect(snap.peak).toBeGreaterThan(INTEGRITY_THRESHOLDS.snapPeakDegPerSec);
    expect(snap.distance).toBeGreaterThanOrEqual(39);
    expect(snap.offset).toBeCloseTo(0.2, 5);
    const calm = snapOf(aim(false), 64)!;
    expect(calm.peak).toBeLessThan(10);
    expect(angleDelta(359, 1)).toBe(-2);
    expect(angleDelta(-179, 179)).toBe(2);
    expect(binomialZ(20, 25, 0.4)).toBeCloseTo(4.08, 2);
  });
  it("defaults to none; needs enough samples before any signal counts", () => {
    expect(integritySignals(demo({})).every((p) => p.level === "none")).toBe(
      true,
    );
    // Two perfect snaps out of 5 engagements: below the 10-engagement minimum.
    expect(
      integritySignals(demo({ snaps: 2, plainAims: 3 })).find(
        (p) => p.steamId === A,
      )?.level,
    ).toBe("none");
  });
  it("reports inhuman snaps with value, threshold and sample size", () => {
    const players = integritySignals(demo({ snaps: 4, plainAims: 8 }));
    expect(players.find((p) => p.steamId === A)).toEqual({
      steamId: A,
      level: "low",
      reasons: [{ code: "inhuman_snaps", value: 4, threshold: 2, n: 12 }],
    });
    expect(players.filter((p) => p.level !== "none")).toHaveLength(1);
    // Flicks that do not land exactly on the target are human.
    const sloppy = demo({ snaps: 0, plainAims: 8 });
    for (let i = 0; i < 4; i++)
      sloppy.events.push({
        ...(sloppy.events[0] as Extract<
          NormalizedDemo["events"][number],
          { type: "damage" }
        >),
        id: `s${i}`,
        aim: aim(true, 3),
      });
    expect(integritySignals(sloppy)[0]!.level).toBe("none");
  });
  it("combines independent signals into elevated/high", () => {
    const players = integritySignals(
      demo({ snaps: 4, plainAims: 8, hsKills: 40, bodyKills: 20 }),
    );
    const a = players.find((p) => p.steamId === A)!;
    expect(a.reasons.map((r) => r.code)).toEqual([
      "inhuman_snaps",
      "headshot_rate",
    ]);
    expect(a.level).toBe("elevated");
    expect(a.reasons[1]!.value).toBeGreaterThanOrEqual(
      INTEGRITY_THRESHOLDS.zScore,
    );
  });
  it("is part of the analysis and scores none on the public fixture", () => {
    const fixture = new URL(
      "../../../apps/demo-parser/testdata/public-cs2.parsed.json",
      import.meta.url,
    );
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(fixture, "utf8"));
    } catch {
      return; // fetched by apps/demo-parser/scripts/fetch-fixture.py; ignored by Git
    }
    const analysis = analyzeDemo(parsed);
    expect(analysis.integrity?.players).toHaveLength(10);
    expect(analysis.integrity?.players.every((p) => p.level === "none")).toBe(
      true,
    );
  });
});
