import {
  LOWER_IS_BETTER,
  type JourneyMetric,
  type JourneyNode,
} from "./journey";

/** First and last value of a metric over the given matches (oldest first). */
export function trendOf(nodes: JourneyNode[], key: JourneyMetric) {
  const values = nodes
    .map((n) => n.metrics[key])
    .filter((v): v is number => v !== undefined);
  if (!values.length) return null;
  const first = values[0]!;
  const last = values[values.length - 1]!;
  const change = last - first;
  const better = LOWER_IS_BETTER.has(key) ? -change : change;
  return {
    values,
    first,
    last,
    change,
    direction:
      values.length < 2 || Math.abs(change) < 1e-9
        ? ("flat" as const)
        : better > 0
          ? ("better" as const)
          : ("worse" as const),
  };
}

/** Tips checked on later matches: how many were applied (partly counts as half). */
export function adherenceCounts(nodes: JourneyNode[]) {
  const all = nodes.flatMap((n) => n.adherence);
  const known = all.filter((a) => a.status !== "unknown");
  return {
    applied: known.filter((a) => a.status === "applied").length,
    partly: known.filter((a) => a.status === "partly").length,
    checked: known.length,
    total: all.length,
  };
}

export type SummaryLine = {
  text: string;
  params: Record<string, number>;
  /** Decimal places for each numeric param. */
  digits: number;
};

/** The plain-language summary on top of the page (deterministic, from the numbers). */
export function summaryLines(nodes: JourneyNode[]): SummaryLine[] {
  const lines: SummaryLine[] = [];
  if (nodes.length >= 2) {
    const adr = trendOf(nodes, "adr");
    const kd = trendOf(nodes, "kd");
    if (adr && adr.values.length >= 2)
      lines.push({
        text: "Over your last {n} matches your ADR went from {from} to {to}.",
        params: { n: nodes.length, from: adr.first, to: adr.last },
        digits: 0,
      });
    else if (kd && kd.values.length >= 2)
      lines.push({
        text: "Over your last {n} matches your K/D went from {from} to {to}.",
        params: { n: nodes.length, from: kd.first, to: kd.last },
        digits: 2,
      });
  }
  const a = adherenceCounts(nodes);
  if (a.checked > 0)
    lines.push({
      text: "You applied {applied} of {checked} coach tips.",
      params: { applied: a.applied, checked: a.checked },
      digits: 0,
    });
  if (nodes.length === 1)
    lines.push({
      text: "Upload your next match to see if you applied the plan.",
      params: {},
      digits: 0,
    });
  return lines;
}
