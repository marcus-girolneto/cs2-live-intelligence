import { PATHS, along, mockMeta } from "./mockMap";

/** Round 3, seconds 8–30: you (index 0) entry onto A, a headshot, a trade death, utility. */
export function mockWindow(from = 8, to = 30) {
  const meta = mockMeta();
  const hz = 8;
  const deaths: Record<number, number> = { 5: 17.2, 9: 19.1, 0: 21.4, 6: 24 };
  const frames = [];
  for (let s = Math.ceil(from * hz); s <= to * hz; s++) {
    const t = s / hz;
    frames.push({
      t,
      p: PATHS.map((path, i) => {
        const dead = deaths[i] !== undefined && t >= deaths[i]!;
        const k = Math.min(1, (Math.min(t, deaths[i] ?? t) - 2) / 24);
        const pos = along(path, k);
        const aim = i === 0 && t > 15 && t < 21.4 ? -110 : pos.yaw;
        const hp = dead ? 0 : i === 0 && t > 18 ? 54 : 100;
        const flashed = i === 6 && t > 15.5 && t < 17.5 ? 0.9 : 0;
        return [
          i,
          Math.round(pos.x),
          Math.round(pos.y),
          Math.round(aim),
          hp,
          !dead,
          i < 5 ? 0 : 1,
          flashed,
        ];
      }),
    });
  }
  const events = [
    {
      t: 12.5,
      type: "grenade",
      grenade: "smoke",
      attacker: 2,
      x: -650,
      y: -1750,
      from: [-200, -700],
    },
    {
      t: 14.1,
      type: "grenade",
      grenade: "molotov",
      attacker: 3,
      x: -500,
      y: -1950,
    },
    {
      t: 15.4,
      type: "grenade",
      grenade: "flash",
      attacker: 0,
      x: -350,
      y: -1500,
    },
    { t: 15.6, type: "flashed", victim: 6, attacker: 0 },
    { t: 16.8, type: "shot", attacker: 0, weapon: 0 },
    { t: 17.0, type: "shot", attacker: 0, weapon: 0 },
    { t: 17.1, type: "damage", attacker: 0, victim: 5, damage: 27 },
    {
      t: 17.2,
      type: "kill",
      attacker: 0,
      victim: 5,
      weapon: 0,
      headshot: true,
      x: -380,
      y: -1800,
      place: "A Site",
    },
    { t: 18.0, type: "shot", attacker: 9, weapon: 1 },
    { t: 18.1, type: "damage", attacker: 9, victim: 0, damage: 46 },
    { t: 18.9, type: "shot", attacker: 2, weapon: 0 },
    {
      t: 19.1,
      type: "kill",
      attacker: 2,
      victim: 9,
      weapon: 0,
      headshot: false,
      x: -300,
      y: -1950,
      place: "Jungle",
    },
    { t: 20.2, type: "grenade", grenade: "he", attacker: 7, x: -300, y: -1650 },
    { t: 21.2, type: "shot", attacker: 7, weapon: 1 },
    {
      t: 21.4,
      type: "kill",
      attacker: 7,
      victim: 0,
      weapon: 1,
      headshot: false,
      x: -290,
      y: -1640,
      place: "Connector",
    },
    { t: 23.6, type: "shot", attacker: 2, weapon: 0 },
    {
      t: 24.0,
      type: "kill",
      attacker: 2,
      victim: 6,
      weapon: 0,
      headshot: true,
      x: -1750,
      y: -1000,
      place: "Short",
    },
    {
      t: 26.5,
      type: "bomb",
      action: "planted",
      attacker: 2,
      x: -300,
      y: -1900,
      place: "A Site",
    },
  ].filter((e) => e.t >= from && e.t <= to);
  return {
    round: 3,
    sampleHz: hz,
    from,
    to,
    players: meta.players,
    frames,
    weapons: ["AK-47", "M4A1-S"],
    events,
  };
}
