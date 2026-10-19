/** Canvas drawing primitives and palette for the 2D replay. */
import {
  cellSize,
  type Point,
  type Projection,
  type ReplayEvent,
  type ReplayMeta,
  type ReplayWindow,
} from "./replay";

export const COLORS = {
  bg: "#070a0e",
  floor: "#151e2a",
  edge: "rgba(124, 160, 205, 0.55)",
  glow: "rgba(93, 156, 236, 0.35)",
  CT: "#5d9cec",
  T: "#e0b050",
  neutral: "#b4bfcc",
  accent: "#f2a93b",
  bad: "#ff5d5d",
  text: "#e9eef4",
  muted: "#8592a3",
};
export const FONT = '"Rajdhani", "Arial Narrow", system-ui, sans-serif';
export const GRENADE_LIFE = {
  smoke: 18,
  molotov: 7,
  he: 0.6,
  flash: 0.35,
  decoy: 3,
};
export const GRENADE_RADIUS = {
  smoke: 144,
  molotov: 110,
  he: 350,
  flash: 220,
  decoy: 40,
};

export type SceneOptions = {
  focus: number | null;
  at?: number;
  brand: string;
  roundLabel: string;
  keyLabel: string;
  reducedMotion: boolean;
  /** Wall-clock seconds, used only for idle pulses. */
  clock: number;
};
export type RenderCache = { key: string; canvas: HTMLCanvasElement | null };

export function silhouette(
  meta: ReplayMeta,
  p: Projection,
  w: number,
  h: number,
  dpr: number,
  cache: RenderCache,
) {
  const key = `${w}x${h}@${dpr}:${meta.outline.length}`;
  if (cache.key === key && cache.canvas) return cache.canvas;
  const c = document.createElement("canvas");
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  const g = c.getContext("2d");
  if (!g) return null;
  g.scale(dpr, dpr);
  const cell = (meta.cell ?? cellSize(meta.outline)) * p.scale;
  const rect = (grow: number) => {
    g.beginPath();
    for (const [x, y] of meta.outline) {
      const s = p.toScreen(x, y);
      g.rect(
        s.x - cell / 2 - grow,
        s.y - cell / 2 - grow,
        cell + grow * 2 + 0.5,
        cell + grow * 2 + 0.5,
      );
    }
    g.fill();
  };
  g.fillStyle = COLORS.edge;
  rect(1.6);
  g.fillStyle = COLORS.floor;
  rect(0);
  cache.key = key;
  cache.canvas = c;
  return c;
}

export function teamColor(win: ReplayWindow, i: number) {
  const team = win.players[i]?.team;
  return team === "CT" ? COLORS.CT : team === "T" ? COLORS.T : COLORS.neutral;
}
export const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

export function grenade(
  ctx: CanvasRenderingContext2D,
  e: ReplayEvent,
  s: Point,
  age: number,
  scale: number,
  clock: number,
) {
  const kind = e.grenade ?? "he";
  const life = e.duration ?? GRENADE_LIFE[kind];
  const k = age / life;
  const r = Math.max(6, GRENADE_RADIUS[kind] * scale);
  ctx.save();
  if (kind === "smoke") {
    const fade = Math.min(1, age / 0.8) * (k > 0.85 ? (1 - k) / 0.15 : 1);
    const g = ctx.createRadialGradient(s.x, s.y, r * 0.2, s.x, s.y, r);
    g.addColorStop(0, `rgba(200, 208, 220, ${0.75 * fade})`);
    g.addColorStop(0.75, `rgba(170, 180, 195, ${0.55 * fade})`);
    g.addColorStop(1, "rgba(170, 180, 195, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "molotov") {
    const fade = k > 0.8 ? (1 - k) / 0.2 : 1;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + clock * 0.7;
      const rr = r * (0.35 + 0.3 * Math.abs(Math.sin(clock * 5 + i * 1.7)));
      const g = ctx.createRadialGradient(
        s.x + Math.cos(a) * rr * 0.9,
        s.y + Math.sin(a) * rr * 0.9,
        0,
        s.x + Math.cos(a) * rr * 0.9,
        s.y + Math.sin(a) * rr * 0.9,
        r * 0.55,
      );
      g.addColorStop(0, `rgba(255, 170, 60, ${0.5 * fade})`);
      g.addColorStop(1, "rgba(255, 80, 30, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(
        s.x + Math.cos(a) * rr * 0.9,
        s.y + Math.sin(a) * rr * 0.9,
        r * 0.55,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  } else if (kind === "he") {
    ctx.strokeStyle = `rgba(255, 140, 60, ${1 - k})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r * (0.2 + 0.8 * k), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 200, 120, ${0.5 * (1 - k)})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r * 0.25 * (1 - k) + 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "flash") {
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
    g.addColorStop(0, `rgba(255, 255, 255, ${0.95 * (1 - k)})`);
    g.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = `rgba(180, 191, 204, ${1 - k})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r * (0.5 + 0.5 * k), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function skull(
  ctx: CanvasRenderingContext2D,
  s: Point,
  a: number,
  hs: boolean,
) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = COLORS.bad;
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(s.x - 6, s.y - 6);
  ctx.lineTo(s.x + 6, s.y + 6);
  ctx.moveTo(s.x + 6, s.y - 6);
  ctx.lineTo(s.x - 6, s.y + 6);
  ctx.stroke();
  if (hs) {
    // Headshot glyph: a small head with a crosshair dot.
    ctx.fillStyle = COLORS.accent;
    ctx.beginPath();
    ctx.arc(s.x + 11, s.y - 10, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.bg;
    ctx.beginPath();
    ctx.arc(s.x + 11, s.y - 10, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  size = 12,
  bg = "rgba(7, 10, 14, 0.78)",
) {
  ctx.font = `700 ${size}px ${FONT}`;
  const w = ctx.measureText(text).width + 10;
  ctx.fillStyle = bg;
  ctx.fillRect(x - w / 2, y - size + 1, w, size + 5);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.fillText(text, x, y + 2);
  ctx.textAlign = "left";
}
