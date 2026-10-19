import type { DemoEvent } from "@cs2/contracts";
import { finite, ratio } from "@/shared/format";
import type { SelectedPlayer, AnalysisBase } from "../hooks/useAnalysisView";
import { metricOf, metricValue } from "./players";
import type { KillRow } from "./types";
/** Everything the screen shows about the selected player (pure). */
export function playerView(
  base: AnalysisBase,
  resultId: string,
  player: SelectedPlayer,
) {
  const { events, names, players, insights, me, accountSteamId, refs } = base;
  const insight = insights.get(player.steamId)!;
  const name = names.get(player.steamId)!;
  const kills = metricValue(player, "kills");
  const deaths = metricValue(player, "deaths");
  const kd = ratio(kills, deaths);
  const adr = metricValue(player, "adr");
  const adrDelta = adr !== null && refs.adr !== null ? adr - refs.adr : null;
  const kast = metricValue(player, "kast");
  const hs = metricValue(player, "headshotPercentage");
  const od = metricOf(player, "opening-success");
  const clutch = metricOf(player, "clutch-wins");
  const rows = player.rounds ?? [];
  const isMe = me?.analysisId === resultId && me.steamId === player.steamId;
  const isYou = isMe || accountSteamId === player.steamId;
  const top = players.indexOf(player) === 0 && adr !== null;
  const feedFor = (round: number): KillRow[] =>
    events
      .filter(
        (e): e is Extract<DemoEvent, { type: "kill" }> =>
          e.type === "kill" && e.round === round,
      )
      .sort((a, b) => a.tick - b.tick)
      .map((e) => ({
        id: e.id,
        ...(e.attackerId ? { attacker: e.attackerId } : {}),
        victim: e.victimId,
        ...(e.attackerTeam ? { attackerSide: e.attackerTeam } : {}),
        ...(e.victimTeam ? { victimSide: e.victimTeam } : {}),
        headshot: e.headshot,
        ...(e.weapon ? { weapon: e.weapon } : {}),
        ...(e.penetrated ? { penetrated: true } : {}),
        ...(e.throughSmoke ? { throughSmoke: true } : {}),
        ...(e.noScope ? { noScope: true } : {}),
        ...(e.attackerBlind ? { attackerBlind: true } : {}),
        ...(finite(e.roundTime) !== null ? { time: e.roundTime! } : {}),
      }));
  const bombsFor = (round: number) =>
    events.filter(
      (e): e is Extract<DemoEvent, { type: "bomb" }> =>
        e.type === "bomb" && e.round === round,
    );
  const teams = (["CT", "T"] as const).map((s) => ({
    side: s,
    list: players.filter((p) => p.start === s),
  }));
  const unknownTeam = players.filter(
    (p) => p.start !== "CT" && p.start !== "T",
  );
  const headShare =
    insight.hitgroups && insight.hitTotal > 0
      ? (insight.hitgroups.head / insight.hitTotal) * 100
      : null;
  const bestWeapon = insight.weapons.find(
    (w) => w.cls !== "grenade" && w.kills > 0,
  );
  const bestPlace = [...insight.places].sort(
    (a, b) => b.kills - b.deaths - (a.kills - a.deaths),
  )[0];
  const worstPlace = [...insight.places].sort(
    (a, b) => a.kills - a.deaths - (b.kills - b.deaths),
  )[0];
  const openingRecord = od?.complete
    ? { won: od.numerator, lost: od.denominator - od.numerator }
    : null;

  return {
    insight,
    name,
    kills,
    deaths,
    kd,
    adr,
    adrDelta,
    kast,
    hs,
    od,
    clutch,
    rows,
    isMe,
    isYou,
    top,
    feedFor,
    bombsFor,
    teams,
    unknownTeam,
    headShare,
    bestWeapon,
    bestPlace,
    worstPlace,
    openingRecord,
  };
}
export type PlayerView = ReturnType<typeof playerView>;
