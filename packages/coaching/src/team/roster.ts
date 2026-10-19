/**
 * Team roster and per-round situations for the team review: who played with the requesting
 * player (same side in most shared rounds), stable aliases P1-P5 (names never reach a model),
 * the timed kills of each round and the alive counts after every kill.
 */
import type { Analysis, DemoEvent, TeamFact } from "@cs2/contracts";
import { confidenceFor } from "../confidence.js";

export type Player = Analysis["players"][number];
export type Kill = Extract<DemoEvent, { type: "kill" }>;
export type Side = "CT" | "T";
export const TRADE_SECONDS = 5;
export const TICK_RATE = 64;
export const r1 = (n: number): number => Math.round(n * 10) / 10;
export const pct = (part: number, whole: number): number | null =>
  whole > 0 ? r1((100 * part) / whole) : null;
/** Seconds since freeze-time end, or from ticks when the parser gave no round time. */
export const timeOf = (e: DemoEvent): number =>
  typeof (e as { roundTime?: unknown }).roundTime === "number"
    ? (e as { roundTime: number }).roundTime
    : e.tick / TICK_RATE;

export type Roster = {
  members: string[];
  enemies: string[];
  alias: Map<string, string>;
  /** The member's side per round. */
  side: (steamId: string, round: number) => Side | undefined;
  /** The team's side in a round (from the members' rows). */
  teamSide: (round: number) => Side | undefined;
};

const sideIn = (p: Player | undefined, round: number) =>
  p?.rounds?.find((r) => r.round === round)?.side;

/** Members (max 5, the requester first in id order) and enemies; aliases follow id order. */
export function rosterOf(analysis: Analysis, steamId: string): Roster {
  const me = analysis.players.find((p) => p.steamId === steamId);
  if (!me) throw new Error("Unknown player");
  const together = (p: Player) => {
    let same = 0;
    let shared = 0;
    for (const r of me.rounds ?? []) {
      const s = sideIn(p, r.round);
      if (!s || !r.side) continue;
      shared++;
      if (s === r.side) same++;
    }
    return shared ? same / shared : 0;
  };
  const mates = analysis.players
    .filter((p) => p.steamId !== steamId && together(p) > 0.5)
    .sort((a, b) => together(b) - together(a))
    .slice(0, 4)
    .map((p) => p.steamId);
  const members = [steamId, ...mates].sort();
  const enemies = analysis.players
    .map((p) => p.steamId)
    .filter((id) => !members.includes(id));
  const alias = new Map(members.map((id, i) => [id, `P${i + 1}`]));
  const byId = new Map(analysis.players.map((p) => [p.steamId, p]));
  return {
    members,
    enemies,
    alias,
    side: (id, round) => sideIn(byId.get(id), round),
    teamSide: (round) => {
      for (const id of members) {
        const s = sideIn(byId.get(id), round);
        if (s) return s;
      }
      return undefined;
    },
  };
}

export type RoundView = {
  round: number;
  side: Side;
  won: boolean | undefined;
  kills: Kill[];
  /** Alive (team, enemy) before each kill and after the last one. */
  alive: [number, number][];
  roundEndId?: string;
};

/** Rounds with the team's side, result, ordered kills and alive counts. */
export function roundViews(analysis: Analysis, roster: Roster): RoundView[] {
  const byRound = new Map<number, DemoEvent[]>();
  for (const e of analysis.events ?? []) {
    if (!byRound.has(e.round)) byRound.set(e.round, []);
    byRound.get(e.round)!.push(e);
  }
  const me = analysis.players.find((p) => p.steamId === roster.members[0]);
  const rounds = new Set<number>([
    ...byRound.keys(),
    ...analysis.players.flatMap((p) => (p.rounds ?? []).map((r) => r.round)),
  ]);
  const out: RoundView[] = [];
  for (const round of [...rounds].sort((a, b) => a - b)) {
    const side = roster.teamSide(round);
    if (!side) continue;
    const events = byRound.get(round) ?? [];
    const kills = events
      .filter((e): e is Kill => e.type === "kill")
      .sort((a, b) => timeOf(a) - timeOf(b) || a.tick - b.tick);
    let team = roster.members.filter((m) => roster.side(m, round)).length;
    let enemy = analysis.players.filter(
      (p) =>
        !roster.members.includes(p.steamId) &&
        sideIn(p, round) &&
        sideIn(p, round) !== side,
    ).length;
    const alive: [number, number][] = [];
    for (const k of kills) {
      alive.push([team, enemy]);
      if (roster.members.includes(k.victimId)) team--;
      else enemy--;
    }
    alive.push([team, enemy]);
    const won =
      analysis.players
        .filter((p) => roster.members.includes(p.steamId))
        .map((p) => p.rounds?.find((r) => r.round === round)?.won)
        .find((w) => w !== undefined) ??
      me?.rounds?.find((r) => r.round === round)?.won;
    const end = events.find((e) => e.type === "round_end");
    out.push({
      round,
      side,
      won,
      kills,
      alive,
      ...(end ? { roundEndId: end.id } : {}),
    });
  }
  return out;
}

/** A citable team fact with its sample size and confidence. */
export function teamFact(
  id: string,
  kind: string,
  description: string,
  value: number | null,
  n: number,
  eventIds: string[] = [],
  steamId?: string,
): TeamFact | undefined {
  if (value === null || !Number.isFinite(value)) return undefined;
  return {
    id: id.slice(0, 128),
    kind,
    ...(steamId ? { steamId } : {}),
    value,
    n,
    confidence: confidenceFor(kind, n),
    description: description.slice(0, 300),
    eventIds: [...new Set(eventIds)].slice(0, 60),
  };
}
export const defined = <T>(list: (T | undefined)[]): T[] =>
  list.filter((x): x is T => x !== undefined);
