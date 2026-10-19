/**
 * Deep module: positioning. For each of the player's deaths: distance to the nearest living
 * teammate (isolation), whether a teammate traded the killer within 5 s, how many distinct
 * enemies damaged the player in the last 5 s (crossfire) and how long the player had held that
 * spot; aggregated per callout, with "danger zones" (callouts where the player dies most).
 */
import type { Analysis, DeepPositioning, Evidence } from "@cs2/contracts";
import { clipsFor } from "../review.js";
import {
  cleanPlace,
  defined,
  eventsOf,
  fact,
  mean,
  pct,
  placeKey,
  r1,
  r2,
  ReplayIndex,
  sidesByRound,
  type KillEvent,
  type Player,
} from "./common.js";

export const TRADE_SECONDS = 5;
export const CROSSFIRE_SECONDS = 5;
/** A death with no living teammate within this many units counts as isolated. */
export const ISOLATED_UNITS = 800;
/** Staying within this radius of the death spot counts as holding it. */
const HOLD_RADIUS = 150;

type Death = DeepPositioning["deathsDetail"][number];

function nearestTeammate(
  replay: ReplayIndex,
  death: KillEvent,
  steamId: string,
): { distance: number | null; hold: number | null } {
  const round = replay.round(death.round);
  const me = replay.track(death.round, steamId);
  const i = replay.sampleBefore(death.round, death.roundTime + 0.01, 0.5);
  if (!round || !me || i < 0) return { distance: null, hold: null };
  const z = (t: typeof me, k: number) => t.z?.[k] ?? 0;
  let best: number | null = null;
  for (const t of round.tracks) {
    if (t === me || !t.alive[i] || !me.team || t.team !== me.team) continue;
    const d = Math.hypot(
      t.x[i]! - me.x[i]!,
      t.y[i]! - me.y[i]!,
      z(t, i) - z(me, i),
    );
    best = best === null ? d : Math.min(best, d);
  }
  let start = i;
  while (
    start > 0 &&
    me.alive[start - 1] &&
    Math.hypot(me.x[start - 1]! - me.x[i]!, me.y[start - 1]! - me.y[i]!) <=
      HOLD_RADIUS
  )
    start--;
  return {
    distance: best === null ? null : Math.round(best),
    hold: r2(Math.max(0, death.roundTime - round.t[start]!)),
  };
}

/** Per-death positioning facts. */
export function deathFacts(
  analysis: Analysis,
  player: Player,
  replay: ReplayIndex,
): Death[] {
  const steamId = player.steamId;
  const sides = sidesByRound(player);
  const kills = eventsOf(analysis, "kill");
  const damage = eventsOf(analysis, "damage");
  return kills
    .filter((k) => k.victimId === steamId && k.attackerId !== steamId)
    .map((k) => {
      const mySide = sides.get(k.round) ?? k.victimTeam;
      const traded = kills.some(
        (x) =>
          x.round === k.round &&
          x.victimId === k.attackerId &&
          x.roundTime > k.roundTime &&
          x.roundTime <= k.roundTime + TRADE_SECONDS &&
          x.attackerTeam === mySide,
      );
      const attackers = new Set<string>(k.attackerId ? [k.attackerId] : []);
      for (const d of damage)
        if (
          d.round === k.round &&
          d.victimId === steamId &&
          d.attackerId &&
          d.attackerTeam !== mySide &&
          d.roundTime <= k.roundTime &&
          d.roundTime >= k.roundTime - CROSSFIRE_SECONDS
        )
          attackers.add(d.attackerId);
      const near = nearestTeammate(replay, k, steamId);
      const place = cleanPlace(k.victimPlace);
      return {
        eventId: k.id,
        round: k.round,
        time: r2(Math.max(0, k.roundTime)),
        ...(place ? { place } : {}),
        nearestTeammate: near.distance,
        traded,
        crossfireEnemies: attackers.size,
        holdSeconds: near.hold,
      };
    });
}

const zoneWhy = (deaths: Death[], place: string): string => {
  const traded = deaths.filter((d) => d.traded).length;
  const iso = defined(deaths.map((d) => d.nearestTeammate ?? undefined));
  const cross = deaths.filter((d) => d.crossfireEnemies >= 2).length;
  const parts = [
    `${deaths.length} deaths at ${place}`,
    `${traded} traded`,
    ...(iso.length
      ? [`nearest teammate ${Math.round(mean(iso)!)} units away on average`]
      : []),
    ...(cross ? [`${cross} in a crossfire`] : []),
  ];
  return `${parts.join(", ")}.`.slice(0, 300);
};

/** The positioning module and its citable facts. */
export function positioningModule(
  analysis: Analysis,
  player: Player,
  replay: ReplayIndex,
): { positioning: DeepPositioning; evidence: Evidence[] } {
  const steamId = player.steamId;
  const deaths = deathFacts(analysis, player, replay);
  const withReplay = deaths.filter((d) => d.holdSeconds !== null);
  const iso = defined(deaths.map((d) => d.nearestTeammate ?? undefined));
  const isolated = withReplay.filter(
    (d) => d.nearestTeammate === null || d.nearestTeammate > ISOLATED_UNITS,
  ).length;
  const byPlace = new Map<string, Death[]>();
  for (const d of deaths)
    if (d.place) byPlace.set(d.place, [...(byPlace.get(d.place) ?? []), d]);
  const byCallout = [...byPlace.entries()]
    .map(([place, list]) => {
      const dist = defined(list.map((d) => d.nearestTeammate ?? undefined));
      return {
        place,
        deaths: list.length,
        traded: list.filter((d) => d.traded).length,
        avgIsolation: dist.length ? Math.round(mean(dist)!) : null,
        avgCrossfire: r2(mean(list.map((d) => d.crossfireEnemies))!),
      };
    })
    .sort((a, b) => b.deaths - a.deaths || a.place.localeCompare(b.place))
    .slice(0, 20);
  const killById = new Map(eventsOf(analysis, "kill").map((k) => [k.id, k]));
  const dangerZones = byCallout
    .filter((c) => c.deaths >= 2)
    .slice(0, 5)
    .map((c) => {
      const list = byPlace.get(c.place)!;
      return {
        place: c.place,
        deaths: c.deaths,
        rounds: [...new Set(list.map((d) => d.round))].slice(0, 40),
        why: zoneWhy(list, c.place),
        clips: clipsFor(
          analysis,
          defined(list.map((d) => killById.get(d.eventId))),
          steamId,
          3,
          `Death at ${c.place}`,
        ),
      };
    });
  const ids = deaths.map((d) => d.eventId);
  const holds = defined(deaths.map((d) => d.holdSeconds ?? undefined));
  const crossfire = deaths.filter((d) => d.crossfireEnemies >= 2).length;
  const evidence = defined([
    fact(
      "deep-pos-deaths",
      "deep-positioning",
      "Your deaths analysed for positioning",
      deaths.length || null,
      ids,
    ),
    fact(
      "deep-pos-isolated",
      "deep-positioning",
      `Deaths with no living teammate within ${ISOLATED_UNITS} units (%)`,
      pct(isolated, withReplay.length),
      ids,
    ),
    fact(
      "deep-pos-avg-isolation",
      "deep-positioning",
      "Average distance to the nearest living teammate when you died (units)",
      iso.length ? Math.round(mean(iso)!) : null,
      ids,
    ),
    fact(
      "deep-pos-traded",
      "deep-positioning",
      `Deaths traded by a teammate within ${TRADE_SECONDS} s (%)`,
      pct(deaths.filter((d) => d.traded).length, deaths.length),
      ids,
    ),
    fact(
      "deep-pos-crossfire",
      "deep-positioning",
      `Deaths where 2+ enemies damaged you in the last ${CROSSFIRE_SECONDS} s (%)`,
      pct(crossfire, deaths.length),
      ids,
    ),
    fact(
      "deep-pos-hold",
      "deep-positioning",
      "Average seconds you had held the spot where you died",
      holds.length ? r1(mean(holds)!) : null,
      ids,
    ),
    ...dangerZones.map((z) =>
      fact(
        `deep-zone-${placeKey(z.place)}`,
        "place-danger",
        `Danger zone: ${z.why}`,
        z.deaths,
        byPlace.get(z.place)!.map((d) => d.eventId),
      ),
    ),
  ]);
  return {
    positioning: {
      deaths: deaths.length,
      avgIsolation: iso.length ? Math.round(mean(iso)!) : null,
      isolatedPct: pct(isolated, withReplay.length),
      tradedPct: pct(deaths.filter((d) => d.traded).length, deaths.length),
      crossfirePct: pct(crossfire, deaths.length),
      avgHoldSeconds: holds.length ? r1(mean(holds)!) : null,
      byCallout,
      dangerZones,
      deathsDetail: deaths.slice(0, 60),
      evidenceIds: evidence.map((e) => e.id),
    },
    evidence,
  };
}
