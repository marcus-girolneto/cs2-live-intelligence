import { describe, expect, it } from "vitest";
import { mockMeta, mockWindow } from "./mock";
import {
  bombAt,
  cellSize,
  effectiveSpeed,
  frameIndex,
  grenadeKind,
  lerpAngle,
  normalizeMeta,
  normalizeWindow,
  project,
  roundClock,
  samplesAt,
} from "./replay";

describe("replay normalisation", () => {
  it("accepts the API shapes and rejects garbage", () => {
    const meta = normalizeMeta(mockMeta())!;
    expect(meta.map).toBe("de_mirage");
    expect(meta.players).toHaveLength(10);
    expect(meta.outline.length).toBeGreaterThan(100);
    expect(cellSize(meta.outline)).toBe(64);
    expect(normalizeMeta(null)).toBeNull();
    expect(
      normalizeMeta({ bounds: { minX: 1, maxX: 0, minY: 0, maxY: 1 } }),
    ).toBeNull();
    const win = normalizeWindow(mockWindow())!;
    expect(win.frames[0]!.t).toBe(8);
    expect(win.frames[0]!.p[0]).toMatchObject({ i: 0, alive: true, hp: 100 });
    const kill = win.events.find((e) => e.type === "kill")!;
    expect(kill).toMatchObject({
      attacker: 0,
      victim: 5,
      weapon: "AK-47",
      headshot: true,
      place: "A Site",
    });
    expect(kill.pos).toEqual({ x: -380, y: -1800 });
    expect(win.events.find((e) => e.grenade === "smoke")?.from).toEqual({
      x: -200,
      y: -700,
    });
    expect(normalizeWindow({ frames: [] })).toBeNull();
    expect(normalizeWindow({ frames: [{ t: "x" }] })).toBeNull();
  });
  it("derives bounds from the outline when missing and maps grenade names", () => {
    const meta = normalizeMeta({
      outline: [
        [0, 0],
        [64, 128],
      ],
    })!;
    expect(meta.bounds).toEqual({ minX: 0, maxX: 64, minY: 0, maxY: 128 });
    expect(grenadeKind("weapon_incgrenade")).toBe("molotov");
    expect(grenadeKind("Smoke Grenade")).toBe("smoke");
    expect(grenadeKind("knife")).toBeUndefined();
  });
});

describe("playback maths", () => {
  const win = normalizeWindow(mockWindow())!;
  it("interpolates positions and angles without sliding across deaths", () => {
    expect(frameIndex(win.frames, 7)).toBe(0);
    expect(frameIndex(win.frames, 8.13)).toBe(1);
    const a = samplesAt(win.frames, 10);
    const b = samplesAt(win.frames, 10.125);
    const mid = samplesAt(win.frames, 10.0625);
    expect(mid[0]!.x).toBeCloseTo((a[0]!.x + b[0]!.x) / 2, 5);
    expect(lerpAngle(170, -170, 0.5)).toBeCloseTo(180);
    const dying = samplesAt(win.frames, 21.43);
    expect(
      dying[0]!.alive === false ||
        dying[0]!.x === samplesAt(win.frames, 21.375)[0]!.x,
    ).toBe(true);
    for (const s of samplesAt(win.frames, 15.3))
      expect(
        Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.yaw),
      ).toBe(true);
  });
  it("projects world to screen with y flipped and keeps the aspect ratio", () => {
    const p = project({ minX: 0, maxX: 100, minY: 0, maxY: 50 }, 220, 220, 10);
    expect(p.scale).toBe(2);
    expect(p.toScreen(0, 50)).toEqual({ x: 10, y: 60 });
    expect(p.toScreen(100, 0)).toEqual({ x: 210, y: 160 });
  });
  it("formats the round clock, bomb state and slow motion", () => {
    expect(roundClock(0)).toBe("1:55");
    expect(roundClock(17.2)).toBe("1:38");
    expect(roundClock(500)).toBe("0:00");
    expect(bombAt(win.events, 20)).toBeNull();
    expect(bombAt(win.events, 27)?.pos).toEqual({ x: -300, y: -1900 });
    expect(effectiveSpeed(1, 17, 17.2, true)).toBeCloseTo(0.3);
    expect(effectiveSpeed(1, 17, 17.2, false)).toBe(1);
    expect(effectiveSpeed(2, 10, 17.2, true)).toBe(2);
  });
  it("reads the backend's real event shapes (shooter, thrower, detonateT, ids)", () => {
    const win = normalizeWindow({
      round: 3,
      sampleHz: 8,
      from: 0,
      to: 40,
      players: [{ steamId: "a", name: "A", team: "T" }],
      weapons: ["Knife", "USP-S"],
      frames: [{ t: 0, p: [[0, 1376, -208, 254, 100, 1, 1, 0, 100]] }],
      events: [
        {
          t: 0.78,
          type: "shot",
          shooter: 0,
          x: -1574.8,
          y: -1659.6,
          yaw: 102,
          weapon: "USP-S",
        },
        {
          t: 3.83,
          type: "grenade",
          grenade: "molotov",
          thrower: 0,
          from: [-824.5, -2312.9],
          to: [102.7, -1635.9],
          detonateT: 5.03,
        },
        {
          t: 6.3,
          type: "flashed",
          id: "ev_f",
          attacker: 0,
          victim: 0,
          durationSeconds: 4.98,
        },
        {
          t: 38.58,
          type: "kill",
          id: "ev_k",
          attacker: 0,
          victim: 0,
          weapon: "MAC-10",
          headshot: true,
          attackerPos: [-985, -771.7],
          victimPos: [-1187.1, -391],
          victimPlace: "Ladder",
        },
      ],
    })!;
    expect(win.frames[0]!.p[0]).toMatchObject({ weapon: 1, alive: true });
    const [shot, nade, flash, kill] = win.events;
    expect(shot).toMatchObject({
      attacker: 0,
      yaw: 102,
      pos: { x: -1574.8, y: -1659.6 },
    });
    expect(nade).toMatchObject({
      t: 5.03,
      attacker: 0,
      grenade: "molotov",
      pos: { x: 102.7, y: -1635.9 },
    });
    expect(flash).toMatchObject({ id: "ev_f", duration: 4.98 });
    expect(kill).toMatchObject({
      id: "ev_k",
      place: "Ladder",
      pos: { x: -1187.1, y: -391 },
      from: { x: -985, y: -771.7 },
    });
    expect(normalizeMeta({ ...mockMeta(), cell: 48 })!.cell).toBe(48);
  });
});
