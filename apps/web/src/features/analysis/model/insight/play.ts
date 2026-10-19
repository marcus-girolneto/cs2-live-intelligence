import type { DemoEvent } from "@cs2/contracts";
import { finite, weaponClass } from "@/shared/format";
import {
  avg,
  type Detail,
  type Economy,
  type Kill,
  type Player,
  type PlayerEvents,
  type Timing,
  type Utility,
} from "./types";

/** Opening, first-kill and death timings (detail first, then kill events). */
export function timingOf(
  d: Detail,
  { id, events, kills, deaths }: PlayerEvents,
): Timing | null {
  if (d?.timing) return d.timing;
  const killT = kills.map((k) => finite(k.roundTime));
  const deathT = deaths.map((k) => finite(k.roundTime));
  if (![...killT, ...deathT].some((v) => v !== null)) return null;
  const byRound = new Map<number, Kill[]>();
  for (const e of events)
    if (e.type === "kill")
      byRound.set(e.round, [...(byRound.get(e.round) ?? []), e]);
  const opening: number[] = [];
  const firstKill: number[] = [];
  for (const list of byRound.values()) {
    const sorted = [...list].sort((a, b) => a.tick - b.tick);
    const first = sorted[0];
    const t0 = finite(first?.roundTime);
    if (
      first &&
      t0 !== null &&
      (first.attackerId === id || first.victimId === id)
    )
      opening.push(t0);
    const mine = sorted.find((k) => k.attackerId === id);
    const t1 = finite(mine?.roundTime);
    if (t1 !== null) firstKill.push(t1);
  }
  const dt = deathT.filter((v): v is number => v !== null);
  return {
    avgOpeningTime: avg(opening),
    avgDeathTime: avg(dt),
    avgFirstKillTime: avg(firstKill),
    earlyDeaths: dt.filter((v) => v < 20).length,
  };
}

/** Grenades thrown, flashes and utility damage (detail first, then events). */
export function utilityOf(
  d: Detail,
  { id, events, damage }: PlayerEvents,
): Utility | null {
  if (d?.utility) return d.utility;
  const nades = events.filter(
    (e) => e.type === "grenade" && e.throwerId === id,
  ) as Extract<DemoEvent, { type: "grenade" }>[];
  const flashed = events.filter(
    (e) => e.type === "flashed" && e.attackerId === id && e.victimId !== id,
  ) as Extract<DemoEvent, { type: "flashed" }>[];
  if (!nades.length && !flashed.length) return null;
  const count = (g: string) => nades.filter((n) => n.grenade === g).length;
  const enemy = flashed.filter(
    (f) => f.attackerTeam && f.victimTeam && f.attackerTeam !== f.victimTeam,
  );
  return {
    flashes: count("flash"),
    smokes: count("smoke"),
    hes: count("he"),
    molotovs: count("molotov"),
    enemiesFlashed: enemy.length,
    teammatesFlashed: flashed.length - enemy.length,
    enemyBlindSeconds: enemy.reduce((n, f) => n + f.durationSeconds, 0),
    flashAssists: events.filter(
      (e) => e.type === "kill" && e.assisterId === id && e.flashAssist,
    ).length,
    utilityDamage: damage
      .filter((x) => weaponClass(x.weapon) === "grenade")
      .reduce((n, x) => n + x.healthDamage, 0),
  };
}

/** Buy types and average equipment value (detail first, then player rounds). */
export function economyOf(d: Detail, player: Player): Economy | null {
  if (d?.economy) return d.economy;
  const rows = player.rounds ?? [];
  if (!rows.some((r) => r.buyType)) return null;
  const buys = { eco: 0, force: 0, full: 0, pistol: 0 };
  for (const r of rows) if (r.buyType) buys[r.buyType]++;
  const values = rows
    .map((r) => finite(r.equipmentValue))
    .filter((v): v is number => v !== null);
  return { avgEquipmentValue: avg(values), buys };
}

export function avgKillDistanceOf(d: Detail, { kills }: PlayerEvents) {
  const distances = kills
    .map((k) => finite(k.distance))
    .filter((v): v is number => v !== null);
  return finite(d?.avgKillDistance) ?? avg(distances);
}
