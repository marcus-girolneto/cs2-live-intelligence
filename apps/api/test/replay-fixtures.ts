import type { ReplayArtifact } from "../src/modules/replay/replay.dto.js";

/** Small synthetic replay: 2 players, 10 Hz-ish samples over 60 s of round 1. */
export function syntheticReplay(): ReplayArtifact {
  const t = Array.from({ length: 481 }, (_, i) => Math.round(i * 12.5) / 100);
  const track = (p: number, team: string, dieAt: number) => ({
    p,
    team,
    x: t.map((s) => Math.min(s, dieAt) * 10 + p),
    y: t.map(() => p * 100),
    yaw: t.map((_, i) => i % 360),
    hp: t.map((s) => (s < dieAt ? 100 : 0)),
    armor: t.map(() => 100),
    w: t.map(() => 0),
    fl: t.map((s) => (s > 5 && s < 6 ? 1 : 0)),
    alive: t.map((s) => (s < dieAt ? 1 : 0)),
  });
  return {
    version: "replay-1",
    map: "de_test",
    tickRate: 64,
    sampleHz: 8,
    players: [
      { steamId: "a", name: "Alpha" },
      { steamId: "b", name: "Bravo" },
    ],
    weapons: ["AK-47", "M4A4"],
    rounds: [
      {
        number: 1,
        freezeTick: 1000,
        duration: 57,
        winner: "T",
        t,
        tracks: [track(0, "T", 999), track(1, "CT", 50)],
        shots: [
          [49.5, 0, 495, 0, 90, 0],
          [10, 1, 101, 100, 270, 1],
        ],
        grenades: [
          {
            type: "flash",
            p: 0,
            t0: 4,
            from: [40, 0],
            t1: 5.5,
            to: [60, 50],
            path: [
              [40, 0],
              [60, 50],
            ],
          },
        ],
        bomb: [{ t: 30, action: "plant", p: 0, pos: [300, 0], site: "A" }],
      },
    ],
    bounds: { minX: 0, maxX: 600, minY: 0, maxY: 100 },
    cell: 48,
    outline: [24, 24, 72, 24],
  };
}
export const syntheticAnalysis = {
  events: [
    {
      id: "ev_kill",
      tick: 1000 + 50 * 64,
      round: 1,
      type: "kill",
      attackerId: "a",
      victimId: "b",
      weapon: "AK-47",
      headshot: true,
      victimPos: { x: 501, y: 100, z: 0 },
    },
    {
      id: "ev_dmg",
      tick: 1000 + 49 * 64,
      round: 1,
      type: "damage",
      attackerId: "a",
      victimId: "b",
      healthDamage: 27,
      weapon: "AK-47",
      hitgroup: "chest",
    },
    {
      id: "ev_flash",
      tick: 1000 + 5.5 * 64,
      round: 1,
      type: "flashed",
      attackerId: "a",
      victimId: "b",
      durationSeconds: 1.2,
    },
    {
      id: "ev_bomb",
      tick: 1000 + 30 * 64,
      round: 1,
      type: "bomb",
      action: "plant",
      playerId: "a",
      site: "A",
    },
    { id: "ev_other", tick: 5, round: 2, type: "kill", victimId: "a" },
  ],
};
