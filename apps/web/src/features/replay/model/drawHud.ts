/** On-canvas HUD of the 2D replay (round clock, bomb, alive counts, labels). */
import { roundClock, type ReplayWindow, type Sample } from "./replay";
import { COLORS, FONT, label, type SceneOptions } from "./drawPrimitives";

export function hud(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  win: ReplayWindow,
  samples: Sample[],
  t: number,
  o: SceneOptions,
) {
  const small = w < 520;
  // Round + clock
  ctx.fillStyle = "rgba(7, 10, 14, 0.82)";
  ctx.fillRect(10, 10, small ? 108 : 132, 40);
  ctx.fillStyle = COLORS.accent;
  ctx.fillRect(10, 10, 3, 40);
  ctx.font = `700 ${small ? 12 : 13}px ${FONT}`;
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(o.roundLabel.toUpperCase(), 20, 26);
  ctx.font = `700 ${small ? 18 : 20}px ${FONT}`;
  ctx.fillStyle = COLORS.text;
  ctx.fillText(roundClock(t), 20, 45);
  // Mini kill feed
  const kills = win.events
    .filter((e) => e.type === "kill" && e.t <= t)
    .slice(-4);
  ctx.font = `700 ${small ? 11 : 13}px ${FONT}`;
  kills.forEach((e, i) => {
    const a = e.attacker !== undefined ? win.players[e.attacker] : undefined;
    const v = e.victim !== undefined ? win.players[e.victim] : undefined;
    const parts = [
      { s: a?.name ?? "", c: a?.team === "CT" ? COLORS.CT : COLORS.T },
      {
        s: e.headshot ? "  ✛ HS  " : "  ▸  ",
        c: e.headshot ? COLORS.accent : COLORS.muted,
      },
      { s: v?.name ?? "", c: v?.team === "CT" ? COLORS.CT : COLORS.T },
    ];
    const width =
      parts.reduce((s, p) => s + ctx.measureText(p.s).width, 0) + 14;
    const x0 = w - 10 - width;
    const y0 = 10 + i * 24;
    const fresh = t - e.t < 1.5;
    ctx.fillStyle = fresh ? "rgba(255, 93, 93, 0.22)" : "rgba(7, 10, 14, 0.78)";
    ctx.fillRect(x0, y0, width, 20);
    let x = x0 + 7;
    for (const p of parts) {
      ctx.fillStyle = p.c;
      ctx.fillText(p.s, x, y0 + 15);
      x += ctx.measureText(p.s).width;
    }
  });
  // Focus player card
  const f = o.focus === null ? undefined : samples.find((s) => s.i === o.focus);
  const fp = o.focus === null ? undefined : win.players[o.focus];
  if (fp) {
    const weapon = f && f.weapon !== null ? win.weapons[f.weapon] : undefined;
    const bw = small ? 150 : 190;
    ctx.fillStyle = "rgba(7, 10, 14, 0.82)";
    ctx.fillRect(10, h - 52, bw, 42);
    ctx.fillStyle = fp.team === "CT" ? COLORS.CT : COLORS.T;
    ctx.fillRect(10, h - 52, 3, 42);
    ctx.font = `700 ${small ? 12 : 14}px ${FONT}`;
    ctx.fillStyle = "#ffc561";
    ctx.fillText(fp.name, 20, h - 35);
    ctx.font = `600 ${small ? 11 : 12}px ${FONT}`;
    ctx.fillStyle = COLORS.text;
    const hp = f?.alive ? `${Math.round(f.hp)} HP` : "✕";
    ctx.fillText(weapon ? `${hp} · ${weapon}` : hp, 20, h - 18);
  }
  // Key moment banner
  if (o.at !== undefined && Math.abs(t - o.at) < 1) {
    label(
      ctx,
      o.keyLabel.toUpperCase(),
      w / 2,
      28,
      COLORS.accent,
      small ? 13 : 15,
    );
  }
  // Watermark
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.font = `700 ${small ? 12 : 14}px ${FONT}`;
  const text = o.brand;
  const tw = ctx.measureText(text).width;
  const x = w - 14 - tw;
  const y = h - 16;
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x - 12, y - 5, 6, 0, Math.PI * 2);
  ctx.moveTo(x - 12, y - 14);
  ctx.lineTo(x - 12, y - 10);
  ctx.moveTo(x - 12, y + 4);
  ctx.lineTo(x - 12, y);
  ctx.stroke();
  ctx.fillStyle = COLORS.text;
  ctx.fillText(text, x, y);
  ctx.restore();
}
