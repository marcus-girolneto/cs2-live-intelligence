/**
 * Deep utility lineups: your most effective throws to repeat (one per grenade type and landing
 * callout) and the utility the lobby threw into the callouts where you died.
 */
import type { Analysis, DeepUtility } from "@cs2/contracts";
import { clipsFor } from "../review.js";
import {
  CalloutIndex,
  cleanPlace,
  defined,
  eventsOf,
  r1,
  type GrenadeEvent,
  uniqueGrenades,
} from "./common.js";

type Nade = DeepUtility["grenades"][number]["type"];
type Throw = DeepUtility["grenades"][number];

/** Score of a throw for "repeat this": enemy blind seconds + damage/10. */
const impact = (t: Throw) => t.enemyBlindSeconds + t.damage / 10;

export function lineups(
  analysis: Analysis,
  steamId: string,
  log: Throw[],
  callouts: CalloutIndex,
): DeepUtility["lineups"] {
  const repeat = log
    .filter(
      (t) =>
        t.verdict === "good" &&
        (t.type === "flash" || t.type === "he" || t.type === "molotov"),
    )
    .sort((a, b) => impact(b) - impact(a) || a.round - b.round)
    // One lineup per grenade type and landing callout (the most effective throw).
    .filter(
      (t, i, all) =>
        all.findIndex(
          (o) =>
            o.type === t.type &&
            (o.landingPlace ?? o.fromPlace) === (t.landingPlace ?? t.fromPlace),
        ) === i,
    )
    .slice(0, 3)
    .map((t) => {
      const target = t.landingPlace ?? t.fromPlace;
      const effect =
        t.type === "flash"
          ? `blinded ${t.enemiesFlashed} enem${t.enemiesFlashed === 1 ? "y" : "ies"} for ${r1(t.enemyBlindSeconds)} s`
          : `dealt ${t.damage} damage`;
      return {
        kind: "repeat" as const,
        title:
          `${t.type === "he" ? "HE" : t.type[0]!.toUpperCase() + t.type.slice(1)}${target ? ` at ${target}` : ""}`.slice(
            0,
            120,
          ),
        type: t.type,
        ...(t.landingPlace ? { place: t.landingPlace } : {}),
        ...(t.fromPlace ? { fromPlace: t.fromPlace } : {}),
        ...(t.from ? { from: t.from } : {}),
        ...(t.landing ? { landing: t.landing } : {}),
        count: 1,
        why: `Round ${t.round}: ${effect}${t.fromPlace ? `, thrown from ${t.fromPlace}` : ""}.`.slice(
          0,
          300,
        ),
        round: t.round,
        ...(t.type === "flash"
          ? {
              enemiesFlashed: t.enemiesFlashed,
              blindSeconds: r1(t.enemyBlindSeconds),
            }
          : { damage: t.damage }),
        eventIds: [t.eventId],
      };
    });
  // Utility the lobby used at the callouts where you died (by landing callout).
  const deaths = eventsOf(analysis, "kill").filter(
    (k) => k.victimId === steamId,
  );
  const deathPlaces = new Set(
    defined(deaths.map((d) => cleanPlace(d.victimPlace))),
  );
  const groups = new Map<
    string,
    { type: Nade; place: string; ids: string[]; from: Map<string, number> }
  >();
  for (const g of uniqueGrenades(analysis)) {
    if (g.throwerId === steamId || !g.pos || g.grenade === "decoy") continue;
    const place = callouts.nearest(g.pos.x, g.pos.y, g.pos.z);
    if (!place || !deathPlaces.has(place)) continue;
    const key = `${g.grenade}|${place}`;
    const group = groups.get(key) ?? {
      type: g.grenade as Nade,
      place,
      ids: [] as string[],
      from: new Map<string, number>(),
    };
    group.ids.push(g.id);
    const from = cleanPlace(g.place);
    if (from) group.from.set(from, (group.from.get(from) ?? 0) + 1);
    groups.set(key, group);
  }
  const learn = [...groups.values()]
    .filter((g) => g.ids.length >= 2)
    .sort(
      (a, b) => b.ids.length - a.ids.length || a.place.localeCompare(b.place),
    )
    .slice(0, 3)
    .map((g) => {
      const from = [...g.from.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const died = deaths.filter(
        (d) => cleanPlace(d.victimPlace) === g.place,
      ).length;
      return {
        kind: "learn" as const,
        title:
          `${g.type === "he" ? "HE" : g.type[0]!.toUpperCase() + g.type.slice(1)} into ${g.place}`.slice(
            0,
            120,
          ),
        type: g.type,
        place: g.place,
        ...(from ? { fromPlace: from } : {}),
        count: g.ids.length,
        why: `The lobby threw ${g.ids.length} ${g.type === "he" ? "HE grenades" : `${g.type}s`} into ${g.place}${from ? ` (mostly from ${from})` : ""}, where you died ${died} time${died === 1 ? "" : "s"}.`.slice(
          0,
          300,
        ),
        deathsThere: died,
        eventIds: g.ids.slice(0, 20),
      };
    });
  return [...repeat, ...learn].map((l) => {
    const events = (analysis.events ?? []).filter(
      (e): e is GrenadeEvent =>
        e.type === "grenade" &&
        l.eventIds.includes(e.id) &&
        typeof e.roundTime === "number",
    );
    const [clip] =
      l.kind === "repeat"
        ? clipsFor(analysis, events.slice(0, 1), steamId, 1, l.title)
        : [];
    return clip ? { ...l, clip } : l;
  });
}
