import type { GlossaryId } from "@/shared/glossary";
import type { JourneyMetric } from "./journey";

/** How each followed metric is labelled, explained and formatted. */
export const METRIC_INFO: Record<
  JourneyMetric,
  { label: string; term?: GlossaryId; unit: "" | "%" | "°"; digits: number }
> = {
  adr: { label: "ADR", term: "adr", unit: "", digits: 0 },
  kd: { label: "K/D", term: "kd", unit: "", digits: 2 },
  kast: { label: "KAST", term: "kast", unit: "%", digits: 0 },
  hsPct: { label: "HS%", term: "hs", unit: "%", digits: 0 },
  accuracy: { label: "Accuracy", term: "accuracy", unit: "%", digits: 0 },
  tradedDeathsPct: {
    label: "Deaths traded",
    term: "trade",
    unit: "%",
    digits: 0,
  },
  openingWinPct: {
    label: "Opening duels won",
    term: "entry",
    unit: "%",
    digits: 0,
  },
  utilityDamagePerRound: {
    label: "Utility damage per round",
    term: "utilityDamage",
    unit: "",
    digits: 0,
  },
  crosshairMedianDeg: {
    label: "Crosshair offset",
    term: "preAim",
    unit: "°",
    digits: 1,
  },
  isolatedDeathsPct: {
    label: "Isolated deaths",
    term: "isolated",
    unit: "%",
    digits: 0,
  },
};

/** The four headline trends on top of the page. */
export const HEADLINE: JourneyMetric[] = ["adr", "kd", "kast", "hsPct"];
/** Up to four numbers shown on each timeline match. */
export const NODE_METRICS: JourneyMetric[] = ["adr", "kd", "kast", "hsPct"];
