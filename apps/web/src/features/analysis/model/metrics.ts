import type { MetricKey } from "./players";
export const METRICS: {
  key: MetricKey;
  label: string;
  unit?: "%" | "adr" | "s" | "m" | "dec";
}[] = [
  { key: "kills", label: "Kills" },
  { key: "deaths", label: "Deaths" },
  { key: "adr", label: "ADR", unit: "adr" },
  { key: "headshotPercentage", label: "Headshot %", unit: "%" },
  { key: "kast", label: "KAST", unit: "%" },
  { key: "survival", label: "Survival", unit: "%" },
  { key: "opening-kills", label: "Opening kills" },
  { key: "opening-deaths", label: "Opening deaths" },
  { key: "opening-success", label: "Opening duels won", unit: "%" },
  { key: "trade-kills", label: "Trade kills" },
  { key: "traded-deaths", label: "Deaths traded", unit: "%" },
  { key: "multi-kill-rounds", label: "Multi-kill rounds" },
  { key: "clutch-wins", label: "Clutches won", unit: "%" },
  { key: "adr-won", label: "ADR in won rounds", unit: "adr" },
  { key: "adr-lost", label: "ADR in lost rounds", unit: "adr" },
  { key: "adr-ct", label: "ADR as CT", unit: "adr" },
  { key: "adr-t", label: "ADR as T", unit: "adr" },
  { key: "zero-damage-rounds", label: "Rounds without damage" },
  { key: "accuracy", label: "Accuracy", unit: "%" },
  { key: "headshot-hit-rate", label: "Hits to the head", unit: "%" },
  {
    key: "utility-damage-per-round",
    label: "Utility damage per round",
    unit: "dec",
  },
  {
    key: "enemies-flashed-per-round",
    label: "Enemies flashed per round",
    unit: "dec",
  },
  { key: "flash-assists", label: "Flash assists" },
  { key: "avg-opening-time", label: "Avg. opening duel time", unit: "s" },
  { key: "avg-death-time", label: "Avg. death time", unit: "s" },
  { key: "early-deaths", label: "Early deaths" },
  { key: "avg-kill-distance", label: "Avg. kill distance", unit: "m" },
  { key: "anti-eco-win-rate", label: "Anti-eco win rate", unit: "%" },
];
export const mean = (v: (number | null | undefined)[]) => {
  const x = v.filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n),
  );
  return x.length ? x.reduce((a, b) => a + b, 0) / x.length : null;
};
