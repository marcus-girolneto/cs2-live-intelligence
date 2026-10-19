/** Frame interpolation, world→screen projection and playback helpers. Pure functions. */
import type { Bounds, Frame, Point, ReplayEvent, Sample } from "./types";

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** Shortest-path angle interpolation in degrees. */
export function lerpAngle(a: number, b: number, k: number) {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * k;
}
/** Index of the last frame with frame.t <= t (binary search). */
export function frameIndex(frames: Frame[], t: number) {
  let lo = 0;
  let hi = frames.length - 1;
  if (t <= frames[0]!.t) return 0;
  if (t >= frames[hi]!.t) return hi;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (frames[mid]!.t <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
/** Players at time t, linearly interpolated between the surrounding frames. */
export function samplesAt(frames: Frame[], t: number): Sample[] {
  if (!frames.length) return [];
  const i = frameIndex(frames, t);
  const a = frames[i]!;
  const b = frames[i + 1];
  if (!b || b.t <= a.t) return a.p;
  const k = Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
  const next = new Map(b.p.map((s) => [s.i, s]));
  return a.p.map((s) => {
    const n = next.get(s.i);
    // Never interpolate across a death (the dot would slide to the corpse).
    if (!n || !s.alive || !n.alive) return k < 0.5 || !n ? s : n;
    return {
      ...s,
      x: lerp(s.x, n.x, k),
      y: lerp(s.y, n.y, k),
      yaw: lerpAngle(s.yaw, n.yaw, k),
      hp: k < 0.5 ? s.hp : n.hp,
      flashed: lerp(s.flashed, n.flashed, k),
      weapon: k < 0.5 ? s.weapon : n.weapon,
    };
  });
}

/** Size of one outline occupancy cell: the smallest positive gap between distinct coordinates. */
export function cellSize(outline: [number, number][]) {
  const gaps = (vals: number[]) => {
    const u = [...new Set(vals.map((v) => Math.round(v * 100) / 100))].sort(
      (a, b) => a - b,
    );
    let g = Infinity;
    for (let i = 1; i < u.length; i++) g = Math.min(g, u[i]! - u[i - 1]!);
    return g;
  };
  const g = Math.min(
    gaps(outline.map((p) => p[0])),
    gaps(outline.map((p) => p[1])),
  );
  return Number.isFinite(g) && g > 0 ? g : 64;
}

export type Projection = {
  scale: number;
  ox: number;
  oy: number;
  toScreen: (x: number, y: number) => Point;
};
/** Fits world bounds into a w×h box (CS y grows north, canvas y grows down). */
export function project(b: Bounds, w: number, h: number, pad = 24): Projection {
  const bw = Math.max(1, b.maxX - b.minX);
  const bh = Math.max(1, b.maxY - b.minY);
  const scale = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh);
  const ox = (w - bw * scale) / 2;
  const oy = (h - bh * scale) / 2;
  return {
    scale,
    ox,
    oy,
    toScreen: (x, y) => ({
      x: ox + (x - b.minX) * scale,
      y: oy + (b.maxY - y) * scale,
    }),
  };
}

/** CS round clock: 1:55 counting down from freeze end, never negative. */
export function roundClock(t: number, roundSeconds = 115) {
  const left = Math.max(0, Math.ceil(roundSeconds - t));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}

/** Last planted-bomb event before t, unless defused/exploded after it. */
export function bombAt(events: ReplayEvent[], t: number) {
  let planted: ReplayEvent | null = null;
  for (const e of events) {
    if (e.t > t) break;
    if (e.type !== "bomb") continue;
    const a = e.action ?? "";
    if (/plant/.test(a) && !/begin|start/.test(a)) planted = e;
    if (/defus(ed)?$|explod/.test(a) && !/begin|start/.test(a)) planted = null;
  }
  return planted;
}

export const playbackSpeeds = [0.25, 0.5, 1, 2] as const;
/** Effective speed: slow-motion (×0.3) within ±1.5 s of the key moment when enabled. */
export function effectiveSpeed(
  speed: number,
  t: number,
  at: number | undefined,
  slowmo: boolean,
) {
  return slowmo && at !== undefined && Math.abs(t - at) <= 1.5
    ? speed * 0.3
    : speed;
}
