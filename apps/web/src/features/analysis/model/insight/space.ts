import { finite } from "@/shared/format";
import {
  sideOf,
  type Detail,
  type Marker,
  type PlaceRow,
  type Player,
  type PlayerEvents,
} from "./types";

/** Kills made from and deaths suffered at each callout, busiest first. */
export function placesOf(
  d: Detail,
  { kills, deaths }: PlayerEvents,
): PlaceRow[] {
  let places: PlaceRow[] = [];
  if (d?.places?.length) places = d.places.map((p) => ({ ...p }));
  else if (
    kills.some((k) => k.attackerPlace) ||
    deaths.some((k) => k.victimPlace)
  ) {
    const agg = new Map<string, PlaceRow>();
    const get = (p: string) => {
      let entry = agg.get(p);
      if (!entry) {
        entry = { place: p, kills: 0, deaths: 0, damage: 0 };
        agg.set(p, entry);
      }
      return entry;
    };
    for (const k of kills) if (k.attackerPlace) get(k.attackerPlace).kills++;
    for (const k of deaths) if (k.victimPlace) get(k.victimPlace).deaths++;
    places = [...agg.values()];
  }
  return places
    .filter((p) => p.place.trim() && (p.kills > 0 || p.deaths > 0))
    .sort((a, b) => b.kills + b.deaths - (a.kills + a.deaths));
}

/** Kill/death positions for the radar (events first, then detail positions). */
export function markersOf(
  player: Player,
  d: Detail,
  { kills, deaths }: PlayerEvents,
): Marker[] {
  let markers: Marker[] = [];
  const fromEvents: Marker[] = [];
  for (const k of kills)
    if (k.attackerPos)
      fromEvents.push({
        kind: "kill",
        round: k.round,
        x: k.attackerPos.x,
        y: k.attackerPos.y,
        ...(k.victimPos
          ? { other: { x: k.victimPos.x, y: k.victimPos.y } }
          : {}),
        ...(k.attackerPlace ? { place: k.attackerPlace } : {}),
        ...(k.weapon ? { weapon: k.weapon } : {}),
        headshot: k.headshot,
        ...(sideOf(k.attackerTeam) ? { side: sideOf(k.attackerTeam) } : {}),
        eventId: k.id,
      });
  for (const k of deaths)
    if (k.victimPos)
      fromEvents.push({
        kind: "death",
        round: k.round,
        x: k.victimPos.x,
        y: k.victimPos.y,
        ...(k.attackerPos
          ? { other: { x: k.attackerPos.x, y: k.attackerPos.y } }
          : {}),
        ...(k.victimPlace ? { place: k.victimPlace } : {}),
        ...(k.weapon ? { weapon: k.weapon } : {}),
        headshot: k.headshot,
        ...(sideOf(k.victimTeam) ? { side: sideOf(k.victimTeam) } : {}),
        eventId: k.id,
      });
  if (fromEvents.length) markers = fromEvents;
  else if (d?.positions?.length) {
    const roundSide = new Map(
      (player.rounds ?? []).map((r) => [r.round, r.side] as const),
    );
    markers = d.positions.map((p) => {
      const side = roundSide.get(p.round);
      return { ...p, ...(side ? { side } : {}) };
    });
  }
  return markers.filter((m) => finite(m.x) !== null && finite(m.y) !== null);
}
