/**
 * Crosshair placement in player terms. Degrees stay internal: every duel's view offset is
 * projected onto the enemy at the duel distance (world units: a player is 72 tall, 32 wide,
 * eyes at 64) and described as "on the enemy", "close" (one small adjustment) or "off" (a big
 * flick), at a body height (head, neck, chest, stomach, legs) and to one side.
 */
export type CrosshairCategory = "on" | "close" | "off";
export type HeightBand =
  "above" | "head" | "neck" | "chest" | "stomach" | "legs";
export type HorizontalBias = "left" | "right" | "centered";

/** One measured duel as stored in deep.crosshair.samples (angles in degrees, internal). */
export type CrosshairDuel = {
  offset: number;
  pitchError: number;
  yawOffset: number;
  /** Signed horizontal error, positive = crosshair right of the enemy (newer reviews). */
  yawError?: number;
  distance: number;
  place?: string;
  won?: boolean;
};

/** World units per "body unit" of the dot plot (half a player's width). */
export const BODY_UNIT = 16;
/** Within about a head's width (plus the replay's one-degree resolution): already on the enemy. */
const ON_UNITS = 16;
const ON_DEGREES = 1.5;
/** One small adjustment away. */
const CLOSE_UNITS = 48;
const CLOSE_DEGREES = 8;
const RAD = Math.PI / 180;

const linear = (degrees: number, distance: number) =>
  distance * Math.tan(Math.min(Math.abs(degrees), 89) * RAD);

export function categoryOf(d: CrosshairDuel): CrosshairCategory {
  const units = linear(d.offset, d.distance);
  if (units <= ON_UNITS || d.offset <= ON_DEGREES) return "on";
  if (units <= CLOSE_UNITS || d.offset <= CLOSE_DEGREES) return "close";
  return "off";
}
/** Height of the crosshair against the enemy's eyes, in world units (positive = above). */
export const verticalUnits = (d: CrosshairDuel) =>
  Math.sign(d.pitchError) * linear(d.pitchError, d.distance);
/** Horizontal offset in world units (positive = right; unsigned for older reviews). */
export const horizontalUnits = (d: CrosshairDuel) =>
  d.yawError === undefined
    ? linear(d.yawOffset, d.distance)
    : Math.sign(d.yawError) * linear(d.yawError, d.distance);

/** Body height band of a vertical offset (world units from the enemy's eyes). */
export function heightBandOf(units: number): HeightBand {
  if (units > 6) return "above";
  if (units >= -6) return "head";
  if (units >= -12) return "neck";
  if (units >= -26) return "chest";
  if (units >= -38) return "stomach";
  return "legs";
}
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

export type CrosshairSummary = {
  preAim: { onTarget: number; close: number; off: number; total: number };
  heightBand: HeightBand | null;
  horizontalBias: HorizontalBias | null;
  perCallout: { callout: string; onTarget: number; total: number }[];
  /** Crosshair at duel start relative to the enemy, in body units (y up, 0 = eyes). */
  dots: { x: number; y: number; won?: boolean; category: CrosshairCategory }[];
};

/** Categories, typical height, side drift, worst callouts and dots of a set of duels. */
export function summarizeCrosshair(duels: CrosshairDuel[]): CrosshairSummary {
  const cats = duels.map(categoryOf);
  const count = (c: CrosshairCategory) => cats.filter((x) => x === c).length;
  // Height and side are judged on duels where the crosshair was near the enemy.
  const near = duels.filter((_, i) => cats[i] !== "off");
  const basis = near.length >= 3 ? near : duels;
  const v = median(basis.map(verticalUnits));
  const signed = basis.filter((d) => d.yawError !== undefined);
  const h = median(signed.map(horizontalUnits));
  const sameSide =
    h === null
      ? 0
      : signed.filter((d) => Math.sign(horizontalUnits(d)) === Math.sign(h))
          .length / signed.length;
  const byPlace = new Map<string, { on: number; total: number }>();
  duels.forEach((d, i) => {
    if (!d.place) return;
    const p = byPlace.get(d.place) ?? { on: 0, total: 0 };
    p.total++;
    if (cats[i] === "on") p.on++;
    byPlace.set(d.place, p);
  });
  return {
    preAim: {
      onTarget: count("on"),
      close: count("close"),
      off: count("off"),
      total: duels.length,
    },
    heightBand: v === null || basis.length < 3 ? null : heightBandOf(v),
    horizontalBias:
      signed.length < 5 || h === null
        ? null
        : Math.abs(h) > 12 && sameSide >= 0.65
          ? h > 0
            ? "right"
            : "left"
          : "centered",
    perCallout: [...byPlace.entries()]
      .filter(([, p]) => p.total >= 2)
      .map(([callout, p]) => ({ callout, onTarget: p.on, total: p.total }))
      .sort(
        (a, b) =>
          (b.total - b.onTarget) / b.total - (a.total - a.onTarget) / a.total ||
          b.total - a.total ||
          a.callout.localeCompare(b.callout),
      )
      .slice(0, 5),
    dots: duels.slice(0, 80).map((d, i) => ({
      x: Math.round(clamp(horizontalUnits(d) / BODY_UNIT, -6, 6) * 100) / 100,
      y: Math.round(clamp(verticalUnits(d) / BODY_UNIT, -6, 3) * 100) / 100,
      ...(d.won !== undefined ? { won: d.won } : {}),
      category: cats[i]!,
    })),
  };
}
/** Share of duels already on the enemy, in % (null without duels). */
export function onTargetPct(duels: CrosshairDuel[]): number | null {
  if (!duels.length) return null;
  return (
    Math.round(
      (duels.filter((d) => categoryOf(d) === "on").length / duels.length) *
        1000,
    ) / 10
  );
}
