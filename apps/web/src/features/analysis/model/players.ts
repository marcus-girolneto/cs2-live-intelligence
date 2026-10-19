import type { Analysis, DemoEvent } from "@cs2/contracts";
import { finite } from "@/shared/format";

type Player = Analysis["players"][number];
export type Side = "CT" | "T";
export type MetricKey =
  "kills" | "deaths" | "adr" | "headshotPercentage" | (string & {});

const BASE = ["kills", "deaths", "adr", "headshotPercentage"] as const;
type BaseKey = (typeof BASE)[number];
const isBase = (key: string): key is BaseKey =>
  (BASE as readonly string[]).includes(key);

export function metricOf(player: Player, key: MetricKey) {
  return isBase(key) ? player[key] : player.advanced?.[key];
}
/** Complete, finite metric value or null; incomplete metrics are never shown as numbers. */
export function metricValue(player: Player, key: MetricKey): number | null {
  const m = metricOf(player, key);
  return m?.complete ? finite(m.value) : null;
}

/** Majority side from the player's own rounds (or events when rounds are missing). */
export function mainSide(player: Player, events: DemoEvent[]): Side | null {
  const seen = { CT: 0, T: 0 };
  for (const r of player.rounds ?? []) if (r.side) seen[r.side]++;
  if (!seen.CT && !seen.T)
    for (const e of events) {
      if (e.type !== "kill" && e.type !== "damage") continue;
      const team =
        e.attackerId === player.steamId
          ? e.attackerTeam
          : e.victimId === player.steamId
            ? e.victimTeam
            : undefined;
      if (team === "CT" || team === "T") seen[team]++;
    }
  if (!seen.CT && !seen.T) return null;
  return seen.CT >= seen.T ? "CT" : "T";
}

/** Display names: demo names when present (escaped by React), otherwise a stable fallback. */
export function nameMap(players: Player[], fallback: (n: number) => string) {
  return new Map(
    players.map((p, i) => [p.steamId, p.name?.trim() || fallback(i + 1)]),
  );
}

/** Rounds that contain any of the given events. */
export function roundsForEvents(eventIds: string[], events: DemoEvent[]) {
  const byId = new Map(events.map((e) => [e.id, e.round]));
  return [
    ...new Set(
      eventIds
        .map((id) => byId.get(id))
        .filter((r): r is number => r !== undefined),
    ),
  ].sort((a, b) => a - b);
}
