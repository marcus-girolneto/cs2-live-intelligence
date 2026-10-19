import type { DemoEvent } from "@cs2/contracts";
import { finite } from "@/shared/format";
import { hitgroupsOf, shotsAndHits, weaponsOf } from "./aim";
import { avgKillDistanceOf, economyOf, timingOf, utilityOf } from "./play";
import { markersOf, placesOf } from "./space";
import {
  pct,
  type Damage,
  type Insight,
  type Kill,
  type Player,
  type PlayerEvents,
  type Shot,
} from "./types";

export {
  BODY_REGIONS,
  type BodyRegion,
  type Insight,
  type Marker,
  type PlaceRow,
  type WeaponRow,
} from "./types";

function eventsOf(id: string, events: DemoEvent[]): PlayerEvents {
  return {
    id,
    events,
    kills: events.filter(
      (e): e is Kill => e.type === "kill" && e.attackerId === id,
    ),
    deaths: events.filter(
      (e): e is Kill => e.type === "kill" && e.victimId === id,
    ),
    damage: events.filter(
      (e): e is Damage =>
        e.type === "damage" && e.attackerId === id && e.victimId !== id,
    ),
    shots: events.filter(
      (e): e is Shot => e.type === "shot" && e.shooterId === id,
    ),
  };
}

/**
 * One view model for the analysis screens. Prefers the analytics package's `detail`
 * breakdown and falls back to enriched demo events; anything unknown stays null so the UI
 * shows an explicit empty state instead of a fabricated zero.
 */
export function playerInsight(
  player: Player,
  events: DemoEvent[] = [],
): Insight {
  const d = player.detail;
  const ev = eventsOf(player.steamId, events);
  const { shots, hits } = shotsAndHits(d, ev);
  const { hitgroups, hitTotal } = hitgroupsOf(d, ev);
  const weapons = weaponsOf(d, ev);
  const places = placesOf(d, ev);
  const markers = markersOf(player, d, ev);
  const timing = timingOf(d, ev);
  const utility = utilityOf(d, ev);
  const economy = economyOf(d, player);
  return {
    shots,
    hits,
    // The analytics metric counts shots that hurt an enemy (pellets are not double counted).
    accuracy:
      (player.advanced?.accuracy?.complete
        ? finite(player.advanced.accuracy.value)
        : null) ?? pct(hits, shots),
    hitgroups,
    hitTotal,
    weapons,
    places,
    markers,
    timing,
    utility,
    economy,
    avgKillDistance: avgKillDistanceOf(d, ev),
    rich:
      shots !== null ||
      hitgroups !== null ||
      weapons.length > 0 ||
      places.length > 0 ||
      markers.length > 0 ||
      timing !== null ||
      utility !== null ||
      economy !== null,
  };
}
