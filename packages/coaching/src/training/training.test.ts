import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { analyzeDemo } from "@cs2/analytics";
import {
  catalogEntrySchema,
  trainingPlanSchema,
  type Analysis,
  type DemoEvent,
} from "@cs2/contracts";
import {
  anglesBetween,
  buildTrainingPlan,
  catalogEntry,
  isAllowedTrainingUrl,
  mapEntry,
  mapTitle,
  normalizeYaw,
  PRACTICE_CONFIG,
  PRO_COACH_METHOD,
  rankSkills,
  resourceLinks,
  SESSION_STEPS,
  setangCommand,
  setposCommand,
  TRAINING_CATALOG,
  trainingCatalog,
  VERIFIED,
  verifyEntry,
  weeklyPractice,
  type DeepReplay,
} from "../index.js";

describe("training catalog", () => {
  it("has a passing Steam verification record for every Workshop id", () => {
    const workshop = TRAINING_CATALOG.filter((e) => e.workshopId);
    expect(workshop.length).toBeGreaterThanOrEqual(20);
    for (const e of workshop) {
      const record = VERIFIED.records.find(
        (r) => r.workshopId === e.workshopId,
      );
      expect(record, `${e.id} ${e.workshopId} not verified`).toBeDefined();
      expect(record!.ok, `${e.id}: ${record!.problems.join("; ")}`).toBe(true);
      expect(record!.consumerAppId).toBe(730);
      expect(record!.banned).toBe(false);
      expect(record!.title.normalize("NFKC")).toBe(
        (e.workshopTitle ?? e.title).normalize("NFKC"),
      );
    }
    expect(Date.parse(VERIFIED.verifiedAt)).not.toBeNaN();
  });

  it("has unique ids and Workshop ids, valid DTOs and only allowed URLs", () => {
    const ids = TRAINING_CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const wids = TRAINING_CATALOG.flatMap((e) =>
      e.workshopId ? [e.workshopId] : [],
    );
    expect(new Set(wids).size).toBe(wids.length);
    const dtos = trainingCatalog();
    expect(dtos).toHaveLength(TRAINING_CATALOG.length);
    for (const d of dtos) {
      expect(catalogEntrySchema.safeParse(d).success, d.id).toBe(true);
      const urls = [d.url, d.links.steam, d.links.web, d.links.launch].filter(
        (u): u is string => !!u,
      );
      for (const u of urls) expect(isAllowedTrainingUrl(u), u).toBe(true);
      if (d.workshopId) {
        expect(d.links.steam).toBe(
          `steam://url/CommunityFilePage/${d.workshopId}`,
        );
        expect(d.links.web).toBe(
          `https://steamcommunity.com/sharedfiles/filedetails/?id=${d.workshopId}`,
        );
        expect(d.links.command).toBe(`host_workshop_map ${d.workshopId}`);
        expect(d.verified).toBeDefined();
      }
    }
  });

  it("covers every skill and has a prefire and utility map per active map", () => {
    for (const skill of [
      "aim",
      "crosshair",
      "utility",
      "spray",
      "movement",
      "positioning",
    ])
      expect(TRAINING_CATALOG.some((e) => e.skill === skill)).toBe(true);
    for (const map of ["de_mirage", "de_dust2", "de_inferno", "de_nuke"]) {
      expect(mapEntry("prefire", map)?.maps).toEqual([map]);
      expect(mapEntry("utility", map)?.maps).toEqual([map]);
    }
    expect(mapEntry("prefire", "de_unknown")).toBeUndefined();
  });
});

describe("Workshop verification", () => {
  const entry = catalogEntry("aim-botz")!;
  const ok = {
    publishedfileid: "3070244462",
    result: 1,
    title: "Aim Botz - Aim Training (CS2)",
    consumer_app_id: 730,
    banned: 0,
    tags: [{ tag: "Cs2" }, { tag: "Map" }],
  };
  it("accepts the matching item and rejects title, app, ban and removal problems", () => {
    expect(verifyEntry(entry, ok).ok).toBe(true);
    expect(verifyEntry(entry, { ...ok, title: "Other" }).problems[0]).toMatch(
      /title/,
    );
    expect(verifyEntry(entry, { ...ok, consumer_app_id: 440 }).ok).toBe(false);
    expect(verifyEntry(entry, { ...ok, banned: 1 }).ok).toBe(false);
    expect(verifyEntry(entry, { ...ok, tags: [] }).ok).toBe(false);
    expect(verifyEntry(entry, { publishedfileid: "1", result: 9 }).ok).toBe(
      false,
    );
    expect(verifyEntry(entry, undefined).ok).toBe(false);
  });
});

describe("launch links", () => {
  it("produces only steam:// and https://steamcommunity.com URLs", () => {
    for (const e of TRAINING_CATALOG) {
      const l = resourceLinks(e);
      for (const u of [l.steam, l.web, l.launch].filter(Boolean))
        expect(isAllowedTrainingUrl(u!), u).toBe(true);
    }
    for (const bad of [
      "http://steamcommunity.com/sharedfiles/filedetails/?id=1",
      "https://steamcommunity.com.evil.example/x",
      "https://evil.example/?https://steamcommunity.com",
      "https://steamcommunity.com@evil.example/",
      "javascript:alert(1)",
      "steam://rungameid/440",
      "steam://url/CommunityFilePage/abc",
      "steam://connect/10.0.0.1",
    ])
      expect(isAllowedTrainingUrl(bad), bad).toBe(false);
    expect(
      resourceLinks({ ...catalogEntry("aim-botz")!, workshopId: "x" }),
    ).toEqual({ launch: "steam://rungameid/730" });
  });
});

describe("console commands", () => {
  it("uses the game's angle convention: yaw 0 = +X, 90 = +Y, pitch positive = down", () => {
    const o = { x: 0, y: 0, z: 64 };
    expect(anglesBetween(o, { x: 100, y: 0, z: 64 })).toEqual({
      yaw: 0,
      pitch: -0,
    });
    expect(anglesBetween(o, { x: 0, y: 100, z: 64 }).yaw).toBeCloseTo(90);
    expect(anglesBetween(o, { x: -100, y: 0, z: 64 }).yaw).toBeCloseTo(180);
    expect(anglesBetween(o, { x: 0, y: -100, z: 64 }).yaw).toBeCloseTo(-90);
    expect(anglesBetween(o, { x: 100, y: 0, z: -36 }).pitch).toBeCloseTo(45);
    expect(anglesBetween(o, { x: 100, y: 0, z: 164 }).pitch).toBeCloseTo(-45);
    expect(normalizeYaw(270)).toBe(-90);
    expect(normalizeYaw(-180)).toBe(180);
  });

  it("formats setpos_exact (origin + 2 units) and setang pitch yaw 0", () => {
    expect(setposCommand({ x: -219.04, y: -2383.86, z: -165.97 })).toBe(
      "setpos_exact -219.0 -2383.9 -164.0",
    );
    expect(setangCommand({ pitch: 11.494, yaw: 183.9 })).toBe(
      "setang 11.49 -176.10 0",
    );
    expect(setangCommand({ pitch: 120, yaw: 0 })).toBe("setang 89.00 0.00 0");
    expect(setangCommand({ pitch: -0.001, yaw: -0.001 })).toBe(
      "setang 0.00 0.00 0",
    );
  });

  it("keeps the practice config to commands verified in the CS2 dump", () => {
    const verified = new Set([
      "sv_cheats",
      "bot_kick",
      "mp_warmup_end",
      "mp_freezetime",
      "mp_roundtime_defuse",
      "mp_buy_anywhere",
      "mp_buytime",
      "mp_maxmoney",
      "mp_startmoney",
      "sv_infinite_ammo",
      "ammo_grenade_limit_total",
      "sv_grenade_trajectory_prac_pipreview",
      "sv_showimpacts",
      "mp_restartgame",
    ]);
    for (const line of PRACTICE_CONFIG)
      expect(verified.has(line.split(" ")[0]!), line).toBe(true);
    expect(PRACTICE_CONFIG[0]).toBe("sv_cheats 1");
    expect(PRACTICE_CONFIG.at(-1)).toBe("mp_restartgame 1");
  });
});

const ME = "76561198000000001";
const FOE = "76561198000000003";
let n = 0;
const ev = (e: Record<string, unknown>): DemoEvent =>
  ({ id: `e${++n}`, round: 1, tick: n, ...e }) as DemoEvent;
const metric = (value: number) => ({
  value,
  numerator: value,
  denominator: 1,
  complete: true,
  formula: "x",
  evidenceIds: [],
});
function analysis(events: DemoEvent[], rounds = 2): Analysis {
  const player = (steamId: string) => ({
    steamId,
    kills: metric(1),
    deaths: metric(2),
    adr: metric(70),
    headshotPercentage: metric(50),
    rounds: Array.from({ length: rounds }, (_, i) => ({
      round: i + 1,
      side: "CT" as const,
      won: false,
      died: true,
      kills: 0,
      damage: 0,
      headshots: 0,
      traded: false,
      damageAssist: false,
    })),
  });
  return {
    schemaVersion: "1.0",
    source: "demo",
    map: "de_dust2",
    events,
    players: [player(ME), player(FOE)],
    evidence: [],
    caveats: [],
  } as Analysis;
}
const death = (round: number, roundTime: number) =>
  ev({
    type: "kill",
    round,
    attackerId: FOE,
    victimId: ME,
    attackerTeam: "T",
    victimTeam: "CT",
    headshot: true,
    weapon: "AK-47",
    attackerPos: { x: 1000, y: 0, z: -100 },
    victimPos: { x: 0, y: 0, z: -100 },
    attackerPlace: "LongDoors",
    victimPlace: "LongA",
    roundTime,
  });

describe("teleports from the demo", () => {
  it("teleports to your deaths, faces the killer without replay, and places a bot at the enemy", () => {
    const plan = buildTrainingPlan({
      analysis: analysis([death(1, 20), death(2, 30)]),
      steamId: ME,
    });
    expect(trainingPlanSchema.safeParse(plan).success).toBe(true);
    const d = plan.teleports.find((t) => t.kind === "death")!;
    expect(d.callout).toBe("LongA");
    expect(d.setpos).toBe("setpos_exact 0.0 0.0 -98.0");
    expect(d.setang).toBe("setang 0.00 0.00 0");
    expect(d.command).toBe(`${d.setpos}; ${d.setang}`);
    const e = plan.teleports.find((t) => t.kind === "enemy")!;
    expect(e.setpos).toBe("setpos_exact 1000.0 0.0 -98.0");
    expect(e.setang).toBe("setang 0.00 180.00 0");
    // From the death spot, look down at the enemy's feet (+8): pitch positive.
    expect(e.botPlace).toMatch(
      /^setpos_exact 0\.0 0\.0 -98\.0; setang 3\.21 0\.00 0; bot_place$/,
    );
    expect(plan.caveats[0]).toMatch(/No replay/);
    expect(plan.serverSetup).toEqual([
      "map de_dust2",
      "bot_add_t",
      "bot_stop 1",
      "bot_dont_shoot 1",
    ]);
  });

  it("uses the replay angle at death and marks it approximate", () => {
    const replay: DeepReplay = {
      players: [{ steamId: ME }, { steamId: FOE }],
      rounds: [1, 2].map((number) => ({
        number,
        t: [19.8, 29.8],
        tracks: [
          {
            p: 0,
            x: [0, 0],
            y: [0, 0],
            z: [-100, -100],
            yaw: [45, 45],
            pitch: [5, 5],
            duck: [1, 1],
            alive: [1, 1],
          },
          {
            p: 1,
            x: [1000, 1000],
            y: [0, 0],
            z: [0, 0],
            yaw: [180, 180],
            pitch: [0, 0],
            alive: [1, 1],
          },
        ],
      })),
    };
    const plan = buildTrainingPlan({
      analysis: analysis([death(1, 20), death(2, 30)]),
      steamId: ME,
      replay,
    });
    const d = plan.teleports.find((t) => t.kind === "death")!;
    expect(d.setang).toBe("setang 5.00 45.00 0");
    expect(d.crouched).toBe(true);
    expect(d.approximate).toBe(true);
  });

  it("never puts an unsafe demo map name into a console command", () => {
    const a = analysis([death(1, 20)]);
    a.map = "de_dust2; quit";
    const plan = buildTrainingPlan({ analysis: a, steamId: ME });
    expect(plan.map).toBeUndefined();
    expect(plan.serverSetup.join(" ")).not.toMatch(/quit/);
  });
});

describe("training plan (pro-team method)", () => {
  it("orders sessions Review, Warmup, Habit, Focus, Debrief with criteria and catalog resources", () => {
    const plan = buildTrainingPlan({
      analysis: analysis([death(1, 20), death(2, 30)]),
      steamId: ME,
      review: {
        planItems: [
          { text: "x", scope: "map", targetMetric: "utilityDamagePerRound" },
          { text: "y", scope: "general", targetMetric: "isolatedDeathsPct" },
        ],
      },
    });
    expect([...plan.focus].sort().slice(0, 2)).toEqual([
      "positioning",
      "utility",
    ]);
    const steps = plan.sessions.map((s) => s.step);
    expect(steps[0]).toBe("review");
    expect(steps[1]).toBe("warmup");
    expect(steps.at(-2)).toBe("focus");
    expect(steps.at(-1)).toBe("debrief");
    expect(steps.filter((s) => s === "habit").length).toBeGreaterThanOrEqual(1);
    for (const s of plan.sessions) {
      expect(s.successCriteria.length).toBeGreaterThan(10);
      expect(s.minutes).toBeGreaterThan(0);
      for (const id of s.resourceIds)
        expect(catalogEntry(id), id).toBeDefined();
      for (const id of s.teleportIds ?? [])
        expect(plan.teleports.some((t) => t.id === id)).toBe(true);
      expect(`${s.title} ${s.why} ${s.successCriteria}`).not.toMatch(
        /\{\w+\}|degree|°/,
      );
    }
    expect(plan.sessions[0]!.code).toBe("review_zone");
    expect(plan.sessions[0]!.params.area).toBe("LongA");
    expect(plan.mindset.text.length).toBeGreaterThan(10);
    expect(
      plan.sessions.find((s) => s.skill === "utility" && s.step === "habit")!
        .resourceIds,
    ).toEqual(["utility-dust2"]);
  });

  it("ranks review targets first, then scores and deep numbers", () => {
    expect(
      rankSkills(
        { planItems: [{ text: "x", scope: "map", targetMetric: "hsPct" }] },
        undefined,
        60,
      )[0],
    ).toBe("aim");
    expect(rankSkills(undefined, undefined, 20, 0.2)).toEqual([
      "crosshair",
      "aim",
    ]);
    expect(rankSkills(undefined, undefined, null)).toEqual(["aim"]);
    expect(PRO_COACH_METHOD.steps.map((s) => s.step)).toEqual([
      ...SESSION_STEPS,
    ]);
    expect(mapTitle("de_dust2")).toBe("Dust 2");
    expect(mapTitle("de_mirage")).toBe("Mirage");
  });

  it("lays out a week of five practice days and two rest days", () => {
    const week = weeklyPractice({
      focus: ["utility", "crosshair"],
      map: "de_mirage",
    });
    expect(week).toHaveLength(7);
    expect(week.filter((d) => d.rest)).toHaveLength(2);
    for (const d of week.filter((x) => !x.rest)) {
      expect(d.steps.map((s) => s.step)).toEqual([...SESSION_STEPS]);
      for (const s of d.steps)
        if (s.resourceId) expect(catalogEntry(s.resourceId)).toBeDefined();
    }
    expect(week[0]!.steps[2]!.resourceId).toBe("utility-mirage");
    expect(week[1]!.steps[2]!.resourceId).toBe("prefire-mirage");
  });
});

const bin = process.env.DEMO_PARSER_BIN;
const fixture = process.env.DEMO_FIXTURE;
describe.skipIf(!bin || !fixture || !existsSync(fixture ?? ""))(
  "training on the real Mirage fixture",
  () => {
    it("yields plausible, deterministic teleports inside the map for every player", () => {
      const dir = mkdtempSync(join(tmpdir(), "training-"));
      const out = execFileSync(
        bin!,
        ["-input", fixture!, "-replay", join(dir, "r.json.gz")],
        { maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "ignore"] },
      );
      const a = analyzeDemo(JSON.parse(out.toString()));
      const raw = JSON.parse(
        gunzipSync(readFileSync(join(dir, "r.json.gz"))).toString(),
      ) as DeepReplay & {
        bounds: { minX: number; maxX: number; minY: number; maxY: number };
      };
      const b = raw.bounds;
      let total = 0;
      for (const p of a.players) {
        const plan = buildTrainingPlan({
          analysis: a,
          steamId: p.steamId,
          replay: raw,
        });
        expect(trainingPlanSchema.safeParse(plan).success).toBe(true);
        expect(plan.map).toBe("de_mirage");
        for (const t of plan.teleports) {
          total++;
          expect(t.x).toBeGreaterThanOrEqual(b.minX - 200);
          expect(t.x).toBeLessThanOrEqual(b.maxX + 200);
          expect(t.y).toBeGreaterThanOrEqual(b.minY - 200);
          expect(t.y).toBeLessThanOrEqual(b.maxY + 200);
          // Mirage floors are between about -400 and +100 world units.
          expect(t.z).toBeGreaterThan(-450);
          expect(t.z).toBeLessThan(200);
          expect(t.setpos).toMatch(
            /^setpos_exact -?\d+\.\d -?\d+\.\d -?\d+\.\d$/,
          );
          expect(t.setang).toMatch(/^setang -?\d+\.\d\d -?\d+\.\d\d 0$/);
        }
        expect(
          JSON.stringify(
            buildTrainingPlan({ analysis: a, steamId: p.steamId, replay: raw }),
          ),
        ).toBe(JSON.stringify(plan));
      }
      expect(total).toBeGreaterThan(30);
    }, 120_000);
  },
);
