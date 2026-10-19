import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { analyzeDemo } from "@cs2/analytics";
import { deepSchema, type Analysis, type DemoEvent } from "@cs2/contracts";
import {
  aimOffset,
  computeDeep,
  deepHistory,
  duelStarts,
  uniqueGrenades,
  wrap,
  type DeepReplay,
} from "./index.js";

const ME = "76561198000000001";
const MATE = "76561198000000002";
const FOE = "76561198000000003";
const FOE2 = "76561198000000004";
let n = 0;
const ev = (e: Record<string, unknown>): DemoEvent =>
  ({ id: `e${++n}`, round: 1, ...e }) as DemoEvent;
const metric = {
  value: 1,
  numerator: 1,
  denominator: 1,
  complete: true,
  formula: "x",
  evidenceIds: [],
};
function analysis(
  events: DemoEvent[],
  rounds = [
    {
      round: 1,
      side: "T" as const,
      won: false,
      died: true,
      kills: 0,
      damage: 0,
      headshots: 0,
      traded: false,
      damageAssist: false,
      deathTime: 12,
    },
  ],
): Analysis {
  const player = (steamId: string) => ({
    steamId,
    kills: metric,
    deaths: metric,
    adr: metric,
    headshotPercentage: metric,
    rounds: steamId === ME ? rounds : [],
  });
  return {
    schemaVersion: "1.0",
    source: "demo",
    map: "de_test",
    events,
    players: [ME, MATE, FOE, FOE2].map(player),
    evidence: [],
    caveats: [],
  } as Analysis;
}
const track = (
  p: number,
  team: string,
  xs: number[],
  extra: Partial<Record<string, number[]>> = {},
) => ({
  p,
  team,
  x: xs,
  y: xs.map(() => 0),
  z: xs.map(() => 0),
  yaw: xs.map(() => 0),
  pitch: xs.map(() => 0),
  duck: xs.map(() => 0),
  alive: xs.map(() => 1),
  ...extra,
});

describe("deep review geometry", () => {
  it("wraps angles and measures yaw/pitch offsets in the game's convention", () => {
    expect(wrap(350)).toBe(-10);
    expect(wrap(-190)).toBe(170);
    const level = aimOffset(
      { yaw: 0, pitch: 0 },
      { x: 0, y: 0, z: 64 },
      { x: 1000, y: 0, z: 64 },
    );
    expect(level.total).toBeCloseTo(0, 5);
    const left = aimOffset(
      { yaw: 10, pitch: 0 },
      { x: 0, y: 0, z: 64 },
      { x: 1000, y: 0, z: 64 },
    );
    expect(left.yaw).toBeCloseTo(10, 5);
    expect(left.total).toBeCloseTo(10, 5);
    // Target 100 units higher at 1000: wanted pitch ≈ -5.7 (looking up). Looking level = too low.
    const low = aimOffset(
      { yaw: 0, pitch: 0 },
      { x: 0, y: 0, z: 64 },
      { x: 1000, y: 0, z: 164 },
    );
    expect(low.pitchError).toBeCloseTo(-5.71, 1);
    const high = aimOffset(
      { yaw: 0, pitch: -10 },
      { x: 0, y: 0, z: 64 },
      { x: 1000, y: 0, z: 64 },
    );
    expect(high.pitchError).toBeCloseTo(10, 5);
  });

  it("splits duels per enemy when 3 s pass without contact and ignores utility damage", () => {
    const a = analysis([
      ev({
        type: "damage",
        tick: 1,
        attackerId: ME,
        victimId: FOE,
        attackerTeam: "T",
        victimTeam: "CT",
        healthDamage: 20,
        weapon: "AK-47",
        roundTime: 10,
      }),
      ev({
        type: "damage",
        tick: 2,
        attackerId: FOE,
        victimId: ME,
        attackerTeam: "CT",
        victimTeam: "T",
        healthDamage: 20,
        weapon: "M4A4",
        roundTime: 11,
      }),
      ev({
        type: "damage",
        tick: 3,
        attackerId: ME,
        victimId: FOE,
        attackerTeam: "T",
        victimTeam: "CT",
        healthDamage: 20,
        weapon: "AK-47",
        roundTime: 15,
      }),
      ev({
        type: "damage",
        tick: 4,
        attackerId: ME,
        victimId: FOE2,
        attackerTeam: "T",
        victimTeam: "CT",
        healthDamage: 40,
        weapon: "HE Grenade",
        roundTime: 15,
      }),
      ev({
        type: "damage",
        tick: 5,
        attackerId: ME,
        victimId: MATE,
        attackerTeam: "T",
        victimTeam: "T",
        healthDamage: 5,
        weapon: "AK-47",
        roundTime: 16,
      }),
    ]);
    expect(duelStarts(a, ME).map((d) => d.roundTime)).toEqual([10, 15]);
  });
});

describe("deep modules", () => {
  const events = [
    // Duplicate flash detonation (parser quirk) blinding one enemy and one teammate.
    ev({
      type: "grenade",
      tick: 100,
      throwerId: ME,
      throwerTeam: "T",
      grenade: "flash",
      pos: { x: 500, y: 0, z: 0 },
      place: "Mid",
      roundTime: 5,
    }),
    ev({
      type: "grenade",
      tick: 100,
      throwerId: ME,
      throwerTeam: "T",
      grenade: "flash",
      pos: { x: 500, y: 0, z: 0 },
      place: "Mid",
      roundTime: 5,
    }),
    ev({
      type: "flashed",
      tick: 100,
      attackerId: ME,
      victimId: FOE,
      attackerTeam: "T",
      victimTeam: "CT",
      durationSeconds: 2.5,
    }),
    ev({
      type: "flashed",
      tick: 101,
      attackerId: ME,
      victimId: MATE,
      attackerTeam: "T",
      victimTeam: "T",
      durationSeconds: 1,
    }),
    ev({
      type: "grenade",
      tick: 200,
      throwerId: ME,
      throwerTeam: "T",
      grenade: "he",
      pos: { x: 900, y: 0, z: 0 },
      place: "Mid",
      roundTime: 6.5,
    }),
    ev({
      type: "damage",
      tick: 200,
      attackerId: ME,
      victimId: FOE,
      attackerTeam: "T",
      victimTeam: "CT",
      healthDamage: 30,
      weapon: "HE Grenade",
      roundTime: 6.5,
    }),
    ev({
      type: "shot",
      tick: 300,
      shooterId: ME,
      shooterTeam: "T",
      weapon: "AK-47",
      roundTime: 7.9,
    }),
    ev({
      type: "damage",
      tick: 310,
      attackerId: ME,
      victimId: FOE,
      attackerTeam: "T",
      victimTeam: "CT",
      healthDamage: 27,
      weapon: "AK-47",
      roundTime: 8,
    }),
    ev({
      type: "damage",
      tick: 500,
      attackerId: FOE2,
      victimId: ME,
      attackerTeam: "CT",
      victimTeam: "T",
      healthDamage: 30,
      weapon: "M4A4",
      roundTime: 11,
    }),
    ev({
      type: "kill",
      tick: 520,
      attackerId: FOE,
      victimId: ME,
      attackerTeam: "CT",
      victimTeam: "T",
      headshot: true,
      weapon: "M4A4",
      victimPlace: "Mid",
      victimPos: { x: 0, y: 0, z: 0 },
      attackerPlace: "Window",
      attackerPos: { x: 1000, y: 0, z: 0 },
      victimGrenades: ["smoke", "molotov"],
      roundTime: 12,
    }),
    ev({
      type: "kill",
      tick: 600,
      attackerId: MATE,
      victimId: FOE,
      attackerTeam: "T",
      victimTeam: "CT",
      headshot: false,
      weapon: "AK-47",
      attackerPos: { x: 2000, y: 0, z: 0 },
      attackerPlace: "Ramp",
      victimPos: { x: 1000, y: 0, z: 0 },
      victimPlace: "Window",
      roundTime: 14,
    }),
  ];
  const t = Array.from({ length: 120 }, (_, i) => i / 8);
  const replay: DeepReplay = {
    players: [
      { steamId: ME },
      { steamId: MATE },
      { steamId: FOE },
      { steamId: FOE2 },
    ],
    rounds: [
      {
        number: 1,
        t,
        tracks: [
          // ME stands at x=0 looking 3° off the enemy at x=1000 (yaw 3), level.
          track(
            0,
            "T",
            t.map(() => 0),
            { yaw: t.map(() => 3) },
          ),
          track(
            1,
            "T",
            t.map(() => 1200),
          ),
          track(
            2,
            "CT",
            t.map(() => 1000),
          ),
          track(
            3,
            "CT",
            t.map(() => 1500),
          ),
        ],
      },
    ],
  };

  it("logs throws with their effect, dedupes detonations and measures utility at death", () => {
    const a = analysis(events);
    expect(uniqueGrenades(a)).toHaveLength(2);
    const { deep, evidence } = computeDeep(a, ME, replay);
    const u = deep.utility!;
    expect(u.thrown).toBe(2);
    const flash = u.grenades.find((g) => g.type === "flash")!;
    expect(flash).toMatchObject({
      enemiesFlashed: 1,
      teammatesFlashed: 1,
      enemyBlindSeconds: 2.5,
      verdict: "good",
    });
    expect(u.stats.flash).toMatchObject({
      thrown: 1,
      enemiesPerFlash: 1,
      teamFlashRate: 50,
      effectivePct: 100,
    });
    expect(u.stats.he).toMatchObject({
      thrown: 1,
      damage: 30,
      damagePerNade: 30,
    });
    expect(u.unusedAtDeath).toEqual({
      deaths: 1,
      deathsWithUtility: 1,
      grenades: { smoke: 1, molotov: 1 },
    });
    expect(evidence.find((e) => e.id === "deep-flash-team-rate")?.value).toBe(
      50,
    );
    expect(deepSchema.safeParse(deep).success).toBe(true);
  });

  it("measures crosshair offset before the first shot and positioning at death", () => {
    const { deep } = computeDeep(analysis(events), ME, replay);
    const c = deep.crosshair!;
    // Duels: FOE at 8 (first shot 7.9 → sample 7.875), FOE2 at 11 (enemy hit first) and FOE
    // again at 12 (more than 3 s after the last contact).
    expect(c.measured).toBe(3);
    expect(c.samples[0]).toMatchObject({
      enemyId: FOE,
      offset: 3,
      yawOffset: 3,
      pitchOffset: 0,
      won: false,
    });
    expect(c.medianOffset).toBe(3);
    expect(c.preAimedPct).toBe(100);
    const p = deep.positioning!;
    expect(p.deathsDetail[0]).toMatchObject({
      nearestTeammate: 1200,
      traded: true,
      crossfireEnemies: 2,
      place: "Mid",
    });
    expect(p.isolatedPct).toBe(100);
    expect(p.tradedPct).toBe(100);
    expect(deep.rounds[0]).toMatchObject({
      round: 1,
      utilityThrown: 2,
      tag: "mistake",
      tags: ["early_death", "zero_damage", "saved_utility"],
    });
  });

  it("skips replay-only facts without samples and says why", () => {
    const { deep } = computeDeep(analysis(events), ME);
    expect(deep.crosshair).toBeUndefined();
    expect(deep.positioning!.deathsDetail[0]!.nearestTeammate).toBeNull();
    expect(deep.caveats.join(" ")).toMatch(/No replay samples/);
  });

  it("compares with previous deep reviews on the map", () => {
    const { deep } = computeDeep(analysis(events), ME, replay);
    const older = structuredClone(deep);
    older.crosshair!.medianOffset = 7;
    const chips = deepHistory(deep, [older, older]);
    expect(chips.find((c) => c.key === "crosshair-offset")).toMatchObject({
      current: 3,
      baseline: 7,
      better: "lower",
      matches: 2,
    });
  });
});

const bin = process.env.DEMO_PARSER_BIN;
const fixture = process.env.DEMO_FIXTURE;
describe.skipIf(!bin || !fixture || !existsSync(fixture ?? ""))(
  "deep review on the real fixture",
  () => {
    it("yields plausible, deterministic numbers for every player", () => {
      const dir = mkdtempSync(join(tmpdir(), "deep-"));
      const out = execFileSync(
        bin!,
        ["-input", fixture!, "-replay", join(dir, "r.json.gz")],
        { maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "ignore"] },
      );
      const a = analyzeDemo(JSON.parse(out.toString()));
      const replay = JSON.parse(
        gunzipSync(readFileSync(join(dir, "r.json.gz"))).toString(),
      ) as DeepReplay;
      const medians: number[] = [];
      for (const p of a.players) {
        const { deep } = computeDeep(a, p.steamId, replay);
        expect(deepSchema.safeParse(deep).success).toBe(true);
        const c = deep.crosshair!;
        expect(c.measured).toBeGreaterThanOrEqual(Math.floor(c.duels * 0.8));
        expect(c.medianOffset!).toBeGreaterThan(0);
        expect(c.medianOffset!).toBeLessThan(15);
        expect(Math.abs(c.pitchBias!)).toBeLessThan(10);
        medians.push(c.medianOffset!);
        expect(JSON.stringify(computeDeep(a, p.steamId, replay))).toBe(
          JSON.stringify(computeDeep(a, p.steamId, replay)),
        );
      }
      medians.sort((x, y) => x - y);
      expect(medians[Math.floor(medians.length / 2)]!).toBeLessThan(8);
    }, 120_000);
  },
);
