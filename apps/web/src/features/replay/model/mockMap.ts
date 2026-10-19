/**
 * Deterministic synthetic replay (shape-identical to the API) for unit tests, previews and
 * screenshots before real backend data exists. Not used by the production data path.
 */
const RECTS: [number, number, number, number][] = [
  [700, -400, 1500, 500], // T spawn
  [-200, -300, 700, 200], // T ramp
  [-700, -2300, 100, -1500], // A site
  [-1200, -900, -400, 200], // mid
  [-400, -1500, -100, -300], // connector
  [-2200, -2300, -700, -1600], // CT
  [-2600, -900, -1700, 600], // B site
  [-1700, 200, -500, 500], // B apps
  [-500, 200, 700, 500], // apps
  [-1900, -1600, -1600, -900], // short
];
function inRect(x: number, y: number) {
  return RECTS.some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d);
}
export function mockMeta() {
  const outline: [number, number][] = [];
  for (let x = -2600; x <= 1500; x += 64)
    for (let y = -2300; y <= 600; y += 64)
      if (inRect(x, y)) outline.push([x, y]);
  const players = [
    ["76561190000000001", "you", "T"],
    ["76561190000000002", "breezy", "T"],
    ["76561190000000003", "kova", "T"],
    ["76561190000000004", "mantis", "T"],
    ["76561190000000005", "drift", "T"],
    ["76561190000000006", "halo", "CT"],
    ["76561190000000007", "nyx", "CT"],
    ["76561190000000008", "rook", "CT"],
    ["76561190000000009", "sable", "CT"],
    ["76561190000000010", "vex", "CT"],
  ].map(([steamId, name, team]) => ({ steamId, name, team }));
  return {
    map: "de_mirage",
    tickRate: 64,
    sampleHz: 8,
    rounds: [1, 2, 3, 4].map((n) => ({
      number: n,
      duration: 80 + n * 5,
      winner: n % 2 ? "T" : "CT",
      ct: players.filter((p) => p.team === "CT").map((p) => p.steamId),
      t: players.filter((p) => p.team === "T").map((p) => p.steamId),
    })),
    players,
    bounds: { minX: -2600, maxX: 1500, minY: -2300, maxY: 600 },
    outline,
  };
}

export type Path = [number, number][];
export const PATHS: Path[] = [
  [
    [1100, 0],
    [400, -100],
    [-100, -500],
    [-250, -1300],
    [-300, -1700],
  ], // you
  [
    [1150, 200],
    [300, 300],
    [-200, 350],
    [-900, 350],
  ],
  [
    [1000, -200],
    [300, -150],
    [-250, -900],
    [-280, -1500],
  ],
  [
    [1200, 100],
    [500, -50],
    [-150, -250],
    [-700, -400],
  ],
  [
    [900, 300],
    [200, 350],
    [-400, 350],
    [-1300, 350],
  ],
  [
    [-1900, -1900],
    [-900, -1900],
    [-500, -1800],
    [-350, -1800],
  ],
  [
    [-2000, -2000],
    [-1800, -1300],
    [-1750, -1000],
  ],
  [
    [-2100, -1800],
    [-1200, -800],
    [-800, -500],
  ],
  [
    [-2200, -600],
    [-2100, 0],
    [-1900, 300],
  ],
  [
    [-1800, -2100],
    [-600, -2100],
    [-200, -2000],
  ],
];
export function along(path: Path, k: number) {
  const segs = path.length - 1;
  const f = Math.min(segs - 1e-6, Math.max(0, k * segs));
  const i = Math.floor(f);
  const a = path[i]!;
  const b = path[i + 1]!;
  const r = f - i;
  return {
    x: a[0] + (b[0] - a[0]) * r,
    y: a[1] + (b[1] - a[1]) * r,
    yaw: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI,
  };
}
