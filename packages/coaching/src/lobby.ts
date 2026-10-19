/**
 * "You vs the lobby" (deterministic, no AI): for key metrics, the player's value, rank in the
 * lobby (1 = best), the lobby median and the best value.
 */
import type { Analysis, LobbyComparison } from "@cs2/contracts";

type Player = Analysis["players"][number];
type Def = {
  key: string;
  label: string;
  unit: string;
  lowerIsBetter?: boolean;
  value: (p: Player) => number | null;
};
const ok = (m: Player["adr"] | undefined): number | null =>
  m && m.complete && m.value !== null && Number.isFinite(m.value)
    ? m.value
    : null;
const rounds = (p: Player) => p.rounds?.length ?? 0;
const adv = (k: string) => (p: Player) => ok(p.advanced?.[k]);
const perRound = (k: string) => (p: Player) => {
  const v = ok(p.advanced?.[k]);
  return v !== null && rounds(p) ? v / rounds(p) : null;
};

export const LOBBY_METRICS: Def[] = [
  { key: "adr", label: "ADR", unit: "", value: (p) => ok(p.adr) },
  {
    key: "kd",
    label: "K/D",
    unit: "",
    value: (p) => {
      const k = ok(p.kills);
      const d = ok(p.deaths);
      return k === null || d === null ? null : k / Math.max(1, d);
    },
  },
  { key: "kast", label: "KAST", unit: "%", value: adv("kast") },
  {
    key: "hsPct",
    label: "Headshot kills",
    unit: "%",
    value: (p) => ok(p.headshotPercentage),
  },
  { key: "accuracy", label: "Accuracy", unit: "%", value: adv("accuracy") },
  {
    key: "openingWinPct",
    label: "Opening duels won",
    unit: "%",
    value: adv("opening-success"),
  },
  {
    key: "tradedDeathsPct",
    label: "Deaths traded",
    unit: "%",
    value: adv("traded-deaths"),
  },
  {
    key: "tradeKillsPerRound",
    label: "Trade kills per round",
    unit: "",
    value: perRound("trade-kills"),
  },
  {
    key: "utilityDamagePerRound",
    label: "Utility damage per round",
    unit: "",
    value: adv("utility-damage-per-round"),
  },
  {
    key: "enemiesFlashedPerRound",
    label: "Enemies flashed per round",
    unit: "",
    value: adv("enemies-flashed-per-round"),
  },
  {
    key: "survivalPct",
    label: "Rounds survived",
    unit: "%",
    value: adv("survival"),
  },
  {
    key: "multiKillRoundsPerRound",
    label: "Multi-kill rounds per round",
    unit: "",
    value: perRound("multi-kill-rounds"),
  },
  {
    key: "earlyDeathsPerRound",
    label: "Early deaths per round",
    unit: "",
    lowerIsBetter: true,
    value: perRound("early-deaths"),
  },
];

const r2 = (n: number) => Math.round(n * 100) / 100;
function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function lobbyComparison(
  analysis: Analysis,
  steamId: string,
): LobbyComparison {
  const me = analysis.players.find((p) => p.steamId === steamId);
  if (!me) throw new Error("Unknown player");
  const metrics = LOBBY_METRICS.map((d) => {
    const values = analysis.players
      .map((p) => d.value(p))
      .filter((v): v is number => v !== null && Number.isFinite(v));
    const mine = d.value(me);
    const better = (a: number, b: number) => (d.lowerIsBetter ? a < b : a > b);
    const best = values.length
      ? values.reduce((a, b) => (better(b, a) ? b : a))
      : null;
    const rank =
      mine === null ? null : 1 + values.filter((v) => better(v, mine)).length;
    const med = median(values);
    return {
      key: d.key,
      label: d.label,
      unit: d.unit,
      lowerIsBetter: !!d.lowerIsBetter,
      value: mine === null ? null : r2(mine),
      rank,
      lobbyMedian: med === null ? null : r2(med),
      best: best === null ? null : r2(best),
      players: values.length,
    };
  });
  return { steamId, players: analysis.players.length, metrics };
}
