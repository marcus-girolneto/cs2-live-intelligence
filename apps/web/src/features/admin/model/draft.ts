import type { Plan, PlanLimits } from "@/features/billing";

export type FeatureFlag =
  | "clipExport"
  | "perMapLearning"
  | "cheaperDeep"
  | "monthlyReport"
  | "matchReel"
  | "historyCompare"
  | "priorityQueue";
export const FEATURE_FLAGS: FeatureFlag[] = [
  "clipExport",
  "perMapLearning",
  "cheaperDeep",
  "monthlyReport",
  "matchReel",
  "historyCompare",
  "priorityQueue",
];
export type NumericLimit = Exclude<
  keyof PlanLimits,
  FeatureFlag | "deepCost" | "personalCoach"
>;
export const NUMERIC_LIMITS: NumericLimit[] = [
  "monthlyCredits",
  "aiReviewsPerDay",
  "liveAiMatchesPerDay",
  "uploadsPerDay",
  "retentionDays",
];
/** "" → unlimited (null); otherwise a non-negative integer. */
export function parseLimit(v: string): number | null | undefined {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 100000 ? n : undefined;
}
/** "14,90" / "14.90" → 1490 cents. */
export function parseMoney(v: string): number | undefined {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n < 100000
    ? Math.round(n * 100)
    : undefined;
}
export const money = (cents: number) => (cents / 100).toFixed(2);
export function setLimit(
  plan: Plan,
  key: NumericLimit,
  value: number | null,
): Plan {
  return { ...plan, limits: { ...plan.limits, [key]: value } };
}
