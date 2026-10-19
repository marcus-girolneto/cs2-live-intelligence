/**
 * Replay DTO normalisation (defensive — every field may be missing). Pure functions.
 */
import { finite, text } from "@/shared/format";
import type {
  Bounds,
  GrenadeKind,
  Point,
  ReplayEvent,
  ReplayMeta,
  ReplayPlayer,
  ReplayWindow,
  Sample,
  Team,
} from "./types";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const team = (v: unknown): Team | null =>
  v === "CT" || v === 3
    ? "CT"
    : v === "T" || v === "TERRORIST" || v === 2
      ? "T"
      : null;
const pick = (o: Obj, keys: string[]) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
};

/** Accepts [x, y(, z)] or {x, y}. */
export function point(v: unknown): Point | undefined {
  if (Array.isArray(v)) {
    const x = finite(v[0]);
    const y = finite(v[1]);
    return x !== null && y !== null ? { x, y } : undefined;
  }
  const o = obj(v);
  if (!o) return undefined;
  const x = finite(o.x);
  const y = finite(o.y);
  return x !== null && y !== null ? { x, y } : undefined;
}

function players(v: unknown): ReplayPlayer[] {
  return arr(v).flatMap((p, i) => {
    const o = obj(p);
    if (!o) return [];
    const steamId = text(o.steamId) ?? `p${i}`;
    return [
      {
        steamId,
        name: text(o.name) ?? `Player ${i + 1}`,
        team: team(o.team),
      },
    ];
  });
}

export function normalizeMeta(raw: unknown): ReplayMeta | null {
  const o = obj(raw);
  if (!o) return null;
  const outline = arr(o.outline)
    .map(point)
    .filter((p): p is Point => !!p)
    .map((p): [number, number] => [p.x, p.y]);
  const b = obj(o.bounds);
  let bounds: Bounds | null =
    b &&
    [b.minX, b.maxX, b.minY, b.maxY].every((n) => finite(n) !== null) &&
    (b.maxX as number) > (b.minX as number) &&
    (b.maxY as number) > (b.minY as number)
      ? {
          minX: b.minX as number,
          maxX: b.maxX as number,
          minY: b.minY as number,
          maxY: b.maxY as number,
        }
      : null;
  if (!bounds && outline.length) {
    const xs = outline.map((p) => p[0]);
    const ys = outline.map((p) => p[1]);
    bounds = {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  }
  if (!bounds) return null;
  return {
    map: text(o.map),
    cell: finite(o.cell),
    tickRate: finite(o.tickRate),
    sampleHz: finite(o.sampleHz) ?? 8,
    rounds: arr(o.rounds).flatMap((r) => {
      const x = obj(r);
      const number = x && finite(x.number ?? x.round);
      if (!x || number === null) return [];
      return [
        {
          number,
          duration: finite(x.duration),
          winner: team(x.winner),
          ct: arr(x.ct).map(String),
          t: arr(x.t).map(String),
        },
      ];
    }),
    players: players(o.players),
    bounds,
    outline,
  };
}

const GRENADES: Record<string, GrenadeKind> = {
  smoke: "smoke",
  smokegrenade: "smoke",
  molotov: "molotov",
  incendiary: "molotov",
  incgrenade: "molotov",
  inferno: "molotov",
  fire: "molotov",
  he: "he",
  hegrenade: "he",
  flash: "flash",
  flashbang: "flash",
  decoy: "decoy",
};
export function grenadeKind(v: unknown): GrenadeKind | undefined {
  const s = text(v)
    ?.toLowerCase()
    .replace(/^weapon_/, "")
    .replace(/[\s_-]/g, "");
  return s ? GRENADES[s] : undefined;
}

function event(raw: unknown, weapons: string[]): ReplayEvent | null {
  const o = obj(raw);
  const thrown = o && finite(o.t);
  const type = o && text(o.type);
  if (!o || thrown === null || !type) return null;
  // Grenades are drawn from the moment they go off.
  const t = type === "grenade" ? (finite(o.detonateT) ?? thrown) : thrown;
  if (!["kill", "shot", "damage", "grenade", "flashed", "bomb"].includes(type))
    return null;
  const idx = (keys: string[]) => {
    const n = finite(pick(o, keys));
    return n !== null && n >= 0 ? Math.round(n) : undefined;
  };
  const w = pick(o, ["weapon", "weaponIndex", "w"]);
  const weapon = typeof w === "number" ? weapons[w] : (text(w) ?? undefined);
  const pos =
    point(pick(o, ["pos", "position", "victimPos", "at", "to", "land"])) ??
    point(o) ??
    undefined;
  const from = point(pick(o, ["from", "attackerPos", "throwerPos", "origin"]));
  const grenade =
    type === "grenade"
      ? (grenadeKind(pick(o, ["grenade", "kind", "grenadeType"])) ??
        grenadeKind(weapon) ??
        "he")
      : undefined;
  const e: ReplayEvent = { t, type: type as ReplayEvent["type"] };
  const a = idx([
    "attacker",
    "shooter",
    "a",
    "attackerIndex",
    "thrower",
    "player",
  ]);
  const v = idx(["victim", "v", "victimIndex"]);
  if (a !== undefined) e.attacker = a;
  if (v !== undefined) e.victim = v;
  if (weapon) e.weapon = weapon;
  if (o.headshot === true || o.hs === true) e.headshot = true;
  if (pos) e.pos = pos;
  if (from) e.from = from;
  if (grenade) e.grenade = grenade;
  const damage = finite(pick(o, ["damage", "healthDamage", "dmg"]));
  if (damage !== null) e.damage = damage;
  const action = text(pick(o, ["action", "kind", "subtype"]));
  if (type === "bomb" && action) e.action = action;
  const place = text(pick(o, ["place", "callout", "victimPlace"]));
  if (place) e.place = place;
  const id = text(o.id);
  if (id) e.id = id;
  const yaw = finite(o.yaw);
  if (yaw !== null) e.yaw = yaw;
  const duration = finite(o.duration ?? o.durationSeconds);
  if (duration !== null && duration > 0) e.duration = duration;
  return e;
}

function sample(raw: unknown): Sample | null {
  if (Array.isArray(raw)) {
    const [i, x, y, yaw, hp, alive, weapon, flashed] = raw;
    const ni = finite(i);
    const nx = finite(x);
    const ny = finite(y);
    if (ni === null || nx === null || ny === null) return null;
    const h = finite(hp) ?? 100;
    return {
      i: ni,
      x: nx,
      y: ny,
      yaw: finite(yaw) ?? 0,
      hp: Math.max(0, Math.min(100, h)),
      alive: alive === undefined ? h > 0 : alive === true || alive === 1,
      weapon: finite(weapon),
      flashed: flashedAmount(flashed),
    };
  }
  const o = obj(raw);
  if (!o) return null;
  return sample([o.i, o.x, o.y, o.yaw, o.hp, o.alive, o.weapon, o.flashed]);
}
/** Flash state may arrive as a boolean, an alpha 0–1 or seconds remaining. */
function flashedAmount(v: unknown) {
  if (v === true) return 1;
  const n = finite(v);
  if (n === null || n <= 0) return 0;
  return n <= 1 ? n : Math.min(1, n / 3);
}

export function normalizeWindow(raw: unknown): ReplayWindow | null {
  const o = obj(raw);
  if (!o) return null;
  const weapons = arr(o.weapons).map((w) => text(w) ?? "");
  const frames = arr(o.frames)
    .flatMap((f) => {
      const x = obj(f);
      const t = x && finite(x.t);
      if (!x || t === null) return [];
      return [
        {
          t,
          p: arr(x.p)
            .map(sample)
            .filter((s): s is Sample => !!s),
        },
      ];
    })
    .sort((a, b) => a.t - b.t);
  if (!frames.length) return null;
  const events = arr(o.events)
    .map((e) => event(e, weapons))
    .filter((e): e is ReplayEvent => !!e)
    .sort((a, b) => a.t - b.t);
  return {
    round: finite(o.round) ?? 0,
    sampleHz: finite(o.sampleHz) ?? 8,
    from: finite(o.from) ?? frames[0]!.t,
    to: finite(o.to) ?? frames.at(-1)!.t,
    players: players(o.players),
    frames,
    weapons,
    events,
  };
}
