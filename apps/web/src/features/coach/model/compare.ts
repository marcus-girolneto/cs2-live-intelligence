/** Quick vs Deep side by side: scores, counts and what the Deep review revealed on top. */
import { overallScore, type CoachReview, type ScoreKey } from "./coaching";

export type Extra = {
  key: "utility" | "crosshair" | "positioning" | "rounds" | "moments";
  /** English template; {n} is the count. */
  label: string;
  n: number;
};
export type Comparison = {
  overall: { quick: number | null; deep: number | null };
  scores: { key: ScoreKey; quick: number | null; deep: number | null }[];
  insights: { quick: number; deep: number };
  moments: { quick: number; deep: number };
  extras: Extra[];
};

export function compareReviews(
  quick: CoachReview,
  deep: CoachReview,
): Comparison {
  const keys = [
    ...new Set([...quick.scores, ...deep.scores].map((s) => s.key)),
  ];
  const val = (r: CoachReview, k: ScoreKey) =>
    r.scores.find((s) => s.key === k)?.value ?? null;
  const d = deep.deep;
  const extras: Extra[] = [];
  if (d?.utility)
    extras.push({
      key: "utility",
      label: "{n} grenades analyzed in the utility lab",
      n:
        d.utility.throws.length ||
        d.utility.perType.reduce((s, x) => s + x.thrown, 0),
    });
  if (d?.crosshair)
    extras.push({
      key: "crosshair",
      label: "{n} duels measured for crosshair placement",
      n: d.crosshair.preAim.total,
    });
  if (d?.positioning)
    extras.push({
      key: "positioning",
      label: "{n} danger zones on your map",
      n: d.positioning.zones.length,
    });
  if (d?.rounds.length)
    extras.push({
      key: "rounds",
      label: "{n} rounds broken down one by one",
      n: d.rounds.length,
    });
  const more = deep.keyMoments.length - quick.keyMoments.length;
  if (more > 0)
    extras.push({ key: "moments", label: "{n} more key moments", n: more });
  return {
    overall: {
      quick: overallScore(quick.scores),
      deep: overallScore(deep.scores),
    },
    scores: keys.map((key) => ({
      key,
      quick: val(quick, key),
      deep: val(deep, key),
    })),
    insights: { quick: quick.insights.length, deep: deep.insights.length },
    moments: { quick: quick.keyMoments.length, deep: deep.keyMoments.length },
    extras: extras.filter((e) => e.n > 0),
  };
}
