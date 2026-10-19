import type { ClipRef, CoachInsight, CoachReview } from "./coaching";

/** One "fix" in plain steps: what happened → why it matters → what to do next match. */
export type Fix = {
  title: string;
  happened: string | null;
  why: string | null;
  todo: string | null;
  clip: ClipRef | null;
  confidence: "early" | "clear" | null;
  round: number | null;
};

export const confidenceOf = (
  c: CoachInsight["confidence"],
): Fix["confidence"] =>
  c === "high" ? "clear" : c === "low" || c === "medium" ? "early" : null;

const RANK = { high: 0, medium: 1, low: 2 } as const;

/**
 * The three things to fix first: the coach's "to improve" findings (clear patterns first),
 * topped up with mistake key moments when there are fewer than three.
 */
export function topFixes(c: CoachReview, max = 3): Fix[] {
  const improve = c.insights
    .filter((i) => i.kind === "improve")
    .sort(
      (a, b) =>
        (a.confidence ? RANK[a.confidence] : 3) -
        (b.confidence ? RANK[b.confidence] : 3),
    );
  const fixes: Fix[] = improve.slice(0, max).map((i) => ({
    title: i.observation,
    happened: null,
    why: i.why ?? null,
    todo: i.actionablePractice ?? null,
    clip: i.clips[0] ?? null,
    confidence: confidenceOf(i.confidence),
    round: null,
  }));
  for (const m of c.keyMoments) {
    if (fixes.length >= max) break;
    if (m.kind !== "mistake") continue;
    fixes.push({
      title: m.title,
      happened: m.whatHappened ?? null,
      why: null,
      todo: m.whatToDoInstead ?? null,
      clip: m.clip ?? null,
      confidence: null,
      round: m.round,
    });
  }
  return fixes;
}

/** What went well (strength findings, then highlight moments), up to `max`. */
export function strengthsOf(c: CoachReview, max = 4): string[] {
  const out = c.insights
    .filter((i) => i.kind === "strength")
    .map((i) => i.observation);
  for (const m of c.keyMoments)
    if (m.kind === "highlight" && out.length < max) out.push(m.title);
  return out.slice(0, max);
}
