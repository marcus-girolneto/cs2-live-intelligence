/**
 * Sample size and confidence of every citable fact. A fact's `n` is the number of
 * observations behind it (duels, rounds, shots, throws, deaths...): the denominator of a rate,
 * otherwise the number of events it was computed from. Confidence: low < 5, medium 5-14,
 * high >= 15 by default; shot-based facts need more samples, round-based ones slightly more.
 */
import type { Evidence } from "@cs2/contracts";

export type Confidence = "low" | "medium" | "high";
export type SampledFact = {
  id: string;
  kind: string;
  value: number | undefined;
  description: string;
  n: number;
  confidence: Confidence;
};

/** [medium from, high from] per fact kind; DEFAULT for everything else. */
export const CONFIDENCE_THRESHOLDS: Record<string, [number, number]> = {
  DEFAULT: [5, 15],
  accuracy: [20, 60],
  "headshot-hit-rate": [20, 60],
  adr: [8, 16],
  kast: [8, 16],
  survival: [8, 16],
  "utility-damage-per-round": [8, 16],
  "enemies-flashed-per-round": [8, 16],
  "deep-crosshair": [8, 20],
  "place-crosshair": [5, 12],
};

export function confidenceFor(kind: string, n: number): Confidence {
  const [medium, high] =
    CONFIDENCE_THRESHOLDS[kind] ?? CONFIDENCE_THRESHOLDS.DEFAULT!;
  return n >= high ? "high" : n >= medium ? "medium" : "low";
}

const RATIO = /:\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/;
/** Observations behind one evidence entry (see the module comment). */
export function sampleSize(
  e: Pick<Evidence, "description" | "eventIds">,
): number {
  const m = RATIO.exec(e.description);
  const denominator = m ? Number(m[2]) : 0;
  if (denominator > 1) return Math.round(denominator);
  return e.eventIds.length;
}

/** Evidence → model-facing fact with n and confidence. */
export function sampled(e: Evidence): SampledFact {
  const n = sampleSize(e);
  return {
    id: e.id,
    kind: e.kind,
    value: e.value,
    description: e.description,
    n,
    confidence: confidenceFor(e.kind, n),
  };
}

const RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
/** The highest confidence among cited facts (unknown ids are ignored; none → low). */
export function citedConfidence(
  ids: string[],
  facts: Map<string, { confidence: Confidence }>,
): Confidence {
  let best: Confidence = "low";
  for (const id of ids) {
    const c = facts.get(id)?.confidence;
    if (c && RANK[c] > RANK[best]) best = c;
  }
  return best;
}

/**
 * Validator rule: an item is never more confident than its best cited fact (so items citing
 * only low-confidence facts are "low"), and low items are ranked last (stable otherwise).
 */
export function enforceConfidence<
  T extends { evidenceIds: string[]; confidence: Confidence },
>(items: T[], facts: Map<string, { confidence: Confidence }>): T[] {
  const capped = items.map((item) => {
    const best = citedConfidence(item.evidenceIds, facts);
    return RANK[item.confidence] > RANK[best]
      ? { ...item, confidence: best }
      : item;
  });
  return [
    ...capped.filter((i) => i.confidence !== "low"),
    ...capped.filter((i) => i.confidence === "low"),
  ];
}

export const HEDGING_RULES = `
CONFIDENCE (every fact has "n", its sample size, and "confidence" low | medium | high computed in code from n):
- A fact with confidence "low" is only an early sign: use hedged wording ("early sign", "in this small sample"; in Portuguese "indício", "nesta amostra pequena") and never state it as a habit.
- Never make an item that rests only on low-confidence facts the top priority (the first insight, the verdict, the main change in the summary or the first plan item).
- An item's "confidence" can never be higher than the best confidence among the facts it cites.`;
