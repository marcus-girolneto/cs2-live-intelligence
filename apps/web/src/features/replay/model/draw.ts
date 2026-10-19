/**
 * Canvas renderer for the 2D tactical replay. Stateless apart from a small cache of the
 * pre-rendered map silhouette; everything is a function of (meta, window, t).
 */
import {
  bombAt,
  project,
  samplesAt,
  type ReplayEvent,
  type ReplayMeta,
  type ReplayWindow,
  type Sample,
} from "./replay";
import {
  COLORS,
  GRENADE_LIFE,
  alpha,
  grenade,
  label,
  silhouette,
  skull,
  teamColor,
  type RenderCache,
  type SceneOptions,
} from "./drawPrimitives";
import { hud } from "./drawHud";

export { COLORS, type RenderCache, type SceneOptions } from "./drawPrimitives";

/** Position of player index i at t, or the victim position stored on an event. */
const posOf = (samples: Sample[], i: number | undefined) =>
  i === undefined ? undefined : samples.find((s) => s.i === i);

export function drawScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dpr: number,
  meta: ReplayMeta,
  win: ReplayWindow,
  t: number,
  o: SceneOptions,
  cache: RenderCache,
) {
  const p = project(meta.bounds, w, h, Math.max(16, Math.min(w, h) * 0.06));
  const scale = p.scale;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, w, h);
  // Tactical grid
  ctx.strokeStyle = "rgba(160, 180, 205, 0.05)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < w; x += 32) ctx.rect(x, 0, 0, h);
  for (let y = 0; y < h; y += 32) ctx.rect(0, y, w, 0);
  ctx.stroke();
  const sil = silhouette(meta, p, w, h, dpr, cache);
  if (sil) {
    ctx.save();
    ctx.filter = "blur(10px)";
    ctx.globalAlpha = 0.55;
    ctx.drawImage(sil, 0, 0, w, h);
    ctx.restore();
    ctx.drawImage(sil, 0, 0, w, h);
  }
  const samples = samplesAt(win.frames, t);
  const at = (e: ReplayEvent) =>
    e.pos ? p.toScreen(e.pos.x, e.pos.y) : undefined;

  // Utility
  for (const e of win.events) {
    if (e.t > t) break;
    if (e.type !== "grenade") continue;
    const s = at(e);
    const kind = e.grenade ?? "he";
    const age = t - e.t;
    if (!s || age > (e.duration ?? GRENADE_LIFE[kind])) continue;
    grenade(ctx, e, s, age, scale, o.reducedMotion ? 0 : o.clock);
    const thrower = e.from ? p.toScreen(e.from.x, e.from.y) : undefined;
    if (thrower && age < 0.7) {
      ctx.save();
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = `rgba(233, 238, 244, ${0.5 * (1 - age / 0.7)})`;
      ctx.beginPath();
      ctx.moveTo(thrower.x, thrower.y);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
      ctx.restore();
    }
  }
  // Bomb
  const bomb = bombAt(win.events, t);
  const bombPos = bomb && at(bomb);
  if (bombPos) {
    const blink = o.reducedMotion || Math.floor(o.clock * 2.5) % 2 === 0;
    ctx.fillStyle = blink ? COLORS.bad : "#7a1f1f";
    ctx.fillRect(bombPos.x - 7, bombPos.y - 5, 14, 10);
    label(ctx, "C4", bombPos.x, bombPos.y - 10, COLORS.bad, 11);
  }
  // Kill markers
  for (const e of win.events) {
    if (e.t > t) break;
    if (e.type !== "kill") continue;
    const s =
      at(e) ??
      (() => {
        const v = posOf(samplesAt(win.frames, e.t), e.victim);
        return v ? p.toScreen(v.x, v.y) : undefined;
      })();
    if (s) skull(ctx, s, t - e.t < 2 ? 1 : 0.55, !!e.headshot);
  }
  // Players
  for (const s of samples) {
    if (!s.alive) continue;
    const c = p.toScreen(s.x, s.y);
    const color = teamColor(win, s.i);
    const yaw = (-s.yaw * Math.PI) / 180;
    const cone = Math.max(36, 520 * scale);
    const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, cone);
    g.addColorStop(0, alpha(color, 0.32));
    g.addColorStop(1, alpha(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.arc(c.x, c.y, cone, yaw - Math.PI / 4, yaw + Math.PI / 4);
    ctx.closePath();
    ctx.fill();
  }
  // Shots, damage
  for (const e of win.events) {
    if (e.t > t) break;
    const age = t - e.t;
    if (e.type === "shot" && age < 0.14) {
      const a =
        e.pos && e.yaw !== undefined
          ? { x: e.pos.x, y: e.pos.y, yaw: e.yaw }
          : (posOf(samples, e.attacker) ??
            posOf(samplesAt(win.frames, e.t), e.attacker));
      if (!a) continue;
      const hit = win.events.find(
        (x) =>
          (x.type === "damage" || x.type === "kill") &&
          x.attacker === e.attacker &&
          x.t >= e.t &&
          x.t - e.t < 0.35,
      );
      const v = hit
        ? posOf(samplesAt(win.frames, hit.t), hit.victim)
        : undefined;
      const from = p.toScreen(a.x, a.y);
      const yaw = (-a.yaw * Math.PI) / 180;
      const to = v
        ? p.toScreen(v.x, v.y)
        : {
            x: from.x + Math.cos(yaw) * 900 * scale,
            y: from.y + Math.sin(yaw) * 900 * scale,
          };
      ctx.strokeStyle = `rgba(255, 226, 150, ${1 - age / 0.14})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
    if ((e.type === "damage" || e.type === "kill") && age < 0.4) {
      const v = posOf(samplesAt(win.frames, e.t), e.victim);
      const s = v ? p.toScreen(v.x, v.y) : at(e);
      if (!s) continue;
      ctx.strokeStyle = `rgba(255, 93, 93, ${1 - age / 0.4})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 8 + age * 40, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // Dots on top
  const showNames = w >= 520;
  for (const s of samples) {
    if (!s.alive) continue;
    const c = p.toScreen(s.x, s.y);
    const color = teamColor(win, s.i);
    const focus = s.i === o.focus;
    if (s.flashed > 0.05) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, s.flashed)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 11, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (focus) {
      const pulse = o.reducedMotion ? 0 : (Math.sin(o.clock * 4) + 1) * 3;
      ctx.strokeStyle = alpha("#ffc561", 0.85);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 13 + pulse, 0, Math.PI * 2);
      ctx.stroke();
      // HP arc
      ctx.strokeStyle =
        s.hp > 50 ? "#4fd18b" : s.hp > 20 ? "#ffb547" : COLORS.bad;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(
        c.x,
        c.y,
        9.5,
        -Math.PI / 2,
        -Math.PI / 2 + (Math.PI * 2 * s.hp) / 100,
      );
      ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.strokeStyle = COLORS.bg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x, c.y, focus ? 7 : 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const name = win.players[s.i]?.name;
    if (name && (focus || showNames))
      label(
        ctx,
        name,
        c.x,
        c.y - (focus ? 22 : 13),
        focus ? "#ffc561" : alpha(COLORS.text, 0.8),
        focus ? 13 : 11,
      );
  }
  // Callouts
  for (const e of win.events) {
    if (e.t > t) break;
    const age = t - e.t;
    if (!e.place || age > 2.5) continue;
    const s = at(e);
    if (s)
      label(
        ctx,
        e.place.toUpperCase(),
        s.x,
        s.y + 24,
        alpha(COLORS.muted, 1 - age / 2.5),
        11,
        "rgba(0,0,0,0)",
      );
  }
  hud(ctx, w, h, win, samples, t, o);
  ctx.restore();
}
