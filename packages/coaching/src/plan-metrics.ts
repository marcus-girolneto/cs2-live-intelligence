/**
 * Plan items carry the metric the next matches are measured on (`targetMetric` + `direction`).
 * v8+ prompts ask the model for it (validated against the enum here); older stored items get a
 * deterministic inference from their wording (EN/PT keywords).
 */
import { TARGET_METRICS, type TargetMetric } from "@cs2/contracts";

export type Direction = "up" | "down";
export type PlanTarget = { targetMetric: TargetMetric; direction: Direction };

/** Lower is better for these metrics. */
export const LOWER_IS_BETTER = new Set<TargetMetric>([
  "crosshairMedianDeg",
  "isolatedDeathsPct",
]);
export const naturalDirection = (m: TargetMetric): Direction =>
  LOWER_IS_BETTER.has(m) ? "down" : "up";

/** Keyword rules, first match wins (order matters: specific before generic). */
const RULES: [RegExp, TargetMetric][] = [
  [/\b(?:trade|trades|trading|traded|refrag\w*|troc\w*)\b/i, "tradedDeathsPct"],
  [
    /\b(?:isolat\w*|alone|solo|sozinh\w*|isolad\w*|spacing|espa[cç]amento|positioning|posicionamento|crossfire|fogo cruzado)\b/i,
    "isolatedDeathsPct",
  ],
  [
    /\b(?:crosshair|pre-?aim\w*|pr[eé]-?mir\w*|mira|head level|altura da cabe[cç]a)\b/i,
    "crosshairMedianDeg",
  ],
  [/\b(?:headshots?|hs|cabe[cç]a|capa)\b/i, "hsPct"],
  [
    /\b(?:utility|nades?|grenades?|granad\w*|flash\w*|smokes?|molotov\w*|incendi\w*|he\b|utilit[aá]ri\w*)\b/i,
    "utilityDamagePerRound",
  ],
  [
    /\b(?:opening|entry|entries|first (?:duel|contact|kill)|abertura|primeiro (?:duelo|contato|abate)|entrada)\b/i,
    "openingWinPct",
  ],
  [/\b(?:accuracy|spray|burst|tap|precis[aã]o)\b/i, "accuracy"],
  [/\b(?:damage|dano|adr)\b/i, "adr"],
  [/\b(?:surviv\w*|sobreviv\w*|kast|impact|impacto)\b/i, "kast"],
  [/\b(?:deaths?|die|dying|mortes?|morrer|morre)\b/i, "kd"],
];

/** Deterministic target for a plan text (economy and mindset items → "none"). */
export function inferTarget(text: string): PlanTarget {
  if (/\b(?:eco|economy|economia|buy|compra|force|save)\b/i.test(text))
    return { targetMetric: "none", direction: "up" };
  for (const [re, metric] of RULES)
    if (re.test(text))
      return { targetMetric: metric, direction: naturalDirection(metric) };
  return { targetMetric: "none", direction: "up" };
}

/** The model's target when valid (enum + direction), else the inference from the text. */
export function planTarget(
  text: string,
  targetMetric: unknown,
  direction: unknown,
): PlanTarget {
  const metric = TARGET_METRICS.find((m) => m === targetMetric);
  if (!metric) return inferTarget(text);
  if (metric === "none") return { targetMetric: "none", direction: "up" };
  return {
    targetMetric: metric,
    direction:
      direction === "up" || direction === "down"
        ? direction
        : naturalDirection(metric),
  };
}
