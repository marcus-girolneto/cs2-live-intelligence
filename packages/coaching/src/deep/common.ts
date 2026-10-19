/**
 * Shared inputs and helpers of the deterministic deep-review modules: the replay samples they
 * read (a structural subset of the parser's replay-1 artifact), event filters, callout lookup
 * and small statistics. Pure functions only.
 */
import type { Analysis, DemoEvent, Evidence } from "@cs2/contracts";

/** One player's columns for a round (pitch/z/duck exist from parser cs2live.3). */
export type DeepTrack = {
  p: number;
  team?: string;
  x: number[];
  y: number[];
  z?: number[];
  yaw: number[];
  pitch?: number[];
  duck?: number[];
  alive: number[];
  fl?: number[];
};
export type DeepReplayRound = {
  number: number;
  t: number[];
  tracks: DeepTrack[];
  grenades?: {
    type: string;
    p: number;
    t0: number;
    from: [number, number];
    t1: number;
    to: [number, number];
  }[];
};
/** The replay samples the deep modules can use (absent: replay-only facts are skipped). */
export type DeepReplay = {
  players: { steamId: string }[];
  rounds: DeepReplayRound[];
};

export type Timed = DemoEvent & { roundTime: number };
export type KillEvent = Extract<Timed, { type: "kill" }>;
export type DamageEvent = Extract<Timed, { type: "damage" }>;
export type ShotEvent = Extract<Timed, { type: "shot" }>;
export type GrenadeEvent = Extract<Timed, { type: "grenade" }>;
export type FlashedEvent = Extract<DemoEvent, { type: "flashed" }>;
export type Player = Analysis["players"][number];

export const timed = (e: DemoEvent): e is Timed =>
  typeof (e as { roundTime?: unknown }).roundTime === "number";
export const r1 = (n: number): number => Math.round(n * 10) / 10;
export const r2 = (n: number): number => Math.round(n * 100) / 100;
export const pct = (part: number, whole: number): number | null =>
  whole > 0 ? r1((100 * part) / whole) : null;
export const ratio = (part: number, whole: number): number | null =>
  whole > 0 ? r2(part / whole) : null;
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}
export const mean = (values: number[]): number | null =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

/** Callout names as written by the game, stripped to safe characters. */
export const cleanPlace = (s: string | undefined): string | undefined =>
  s
    ? s.replace(/[^\p{L}\p{N} _.-]/gu, "").slice(0, 64) || undefined
    : undefined;
/** Stable evidence-id fragment of a callout. */
export const placeKey = (place: string): string =>
  place
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 40)
    .toLowerCase() || "unknown";

export const UTILITY_WEAPONS = new Set([
  "HE Grenade",
  "Molotov",
  "Incendiary Grenade",
  "Smoke Grenade",
  "Flashbang",
  "Decoy Grenade",
]);
const NON_DUEL_WEAPONS = new Set([...UTILITY_WEAPONS, "C4", "World", ""]);
/** Gun (or knife/Zeus) damage: a duel weapon, not utility, bomb or world damage. */
export const duelWeapon = (weapon: string | undefined): boolean =>
  !!weapon && !NON_DUEL_WEAPONS.has(weapon);

/** Timed events of one type, in match order. */
export function eventsOf<T extends Timed["type"]>(
  analysis: Analysis,
  type: T,
): Extract<Timed, { type: T }>[] {
  return (analysis.events ?? []).filter(
    (e): e is Extract<Timed, { type: T }> => e.type === type && timed(e),
  );
}

/** The player's side per round (from the per-round metrics). */
export function sidesByRound(player: Player): Map<number, "CT" | "T"> {
  const out = new Map<number, "CT" | "T">();
  for (const r of player.rounds ?? []) if (r.side) out.set(r.round, r.side);
  return out;
}

/**
 * Callout lookup from the match's own labelled positions (kill attacker/victim positions with
 * the game's place names): the nearest labelled point within `maxDistance` world units.
 */
export class CalloutIndex {
  private readonly points: {
    x: number;
    y: number;
    z: number;
    place: string;
  }[] = [];
  constructor(analysis: Analysis) {
    for (const e of analysis.events ?? []) {
      if (e.type !== "kill") continue;
      const a = cleanPlace(e.attackerPlace);
      const v = cleanPlace(e.victimPlace);
      if (e.attackerPos && a) this.points.push({ ...e.attackerPos, place: a });
      if (e.victimPos && v) this.points.push({ ...e.victimPos, place: v });
    }
  }
  get size(): number {
    return this.points.length;
  }
  nearest(
    x: number,
    y: number,
    z?: number,
    maxDistance = 600,
  ): string | undefined {
    let best: string | undefined;
    let bestD = maxDistance;
    for (const p of this.points) {
      const d = Math.hypot(
        p.x - x,
        p.y - y,
        z === undefined ? 0 : (p.z - z) / 2,
      );
      if (d < bestD) {
        bestD = d;
        best = p.place;
      }
    }
    return best;
  }
}

/** Replay lookups: track of a player in a round and the sample just before a time. */
export class ReplayIndex {
  private readonly index = new Map<string, number>();
  private readonly rounds = new Map<number, DeepReplayRound>();
  constructor(readonly replay: DeepReplay | undefined) {
    replay?.players.forEach((p, i) => this.index.set(p.steamId, i));
    for (const r of replay?.rounds ?? []) this.rounds.set(r.number, r);
  }
  get available(): boolean {
    return !!this.replay && this.rounds.size > 0;
  }
  /** True when the replay carries view pitch and height (parser cs2live.3+). */
  get hasAngles(): boolean {
    for (const r of this.rounds.values())
      for (const t of r.tracks)
        if (t.pitch?.length === r.t.length && t.z?.length === r.t.length)
          return true;
    return false;
  }
  playerIndex(steamId: string): number | undefined {
    return this.index.get(steamId);
  }
  round(number: number): DeepReplayRound | undefined {
    return this.rounds.get(number);
  }
  track(round: number, steamId: string): DeepTrack | undefined {
    const p = this.index.get(steamId);
    return p === undefined
      ? undefined
      : this.rounds.get(round)?.tracks.find((t) => t.p === p);
  }
  /** Index of the last sample strictly before `time` (within `maxGap` seconds), or -1. */
  sampleBefore(round: number, time: number, maxGap = 0.3): number {
    const r = this.rounds.get(round);
    if (!r) return -1;
    let found = -1;
    for (let i = 0; i < r.t.length && r.t[i]! < time; i++) found = i;
    return found >= 0 && time - r.t[found]! <= maxGap ? found : -1;
  }
}

/** A citable deep fact (only numbers that exist; ids are stable per module). */
export function fact(
  id: string,
  kind: string,
  description: string,
  value: number | null,
  eventIds: string[] = [],
): Evidence | undefined {
  return value === null || !Number.isFinite(value)
    ? undefined
    : {
        id: id.slice(0, 128),
        kind,
        description: description.slice(0, 500),
        value,
        eventIds: eventIds.slice(0, 40),
      };
}
export const defined = <T>(list: (T | undefined)[]): T[] =>
  list.filter((x): x is T => x !== undefined);

/** Grenade events, dropping the parser's duplicate detonations (same thrower/type/tick/pos). */
export function uniqueGrenades(analysis: Analysis): GrenadeEvent[] {
  const seen = new Set<string>();
  return eventsOf(analysis, "grenade").filter((g) => {
    const key = `${g.round}|${g.throwerId}|${g.grenade}|${Math.round(g.tick / 4)}|${g.pos ? `${Math.round(g.pos.x)},${Math.round(g.pos.y)}` : ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
