/** Admin: reprocess progress, prompt ratings and the latest AI eval (all optional endpoints). */
import { finite, text } from "@/shared/format";

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export type ReprocessStatus = {
  pending: number;
  done: number;
  failed: number;
  currentVersion: string | null;
};
export function normalizeReprocess(raw: unknown): ReprocessStatus {
  const o = obj(raw);
  const n = (v: unknown) => Math.max(0, Math.round(finite(v) ?? 0));
  return {
    pending: n(o.pending),
    done: n(o.done),
    failed: n(o.failed),
    currentVersion: text(o.currentVersion),
  };
}

export type RatingRow = {
  purpose: string;
  variant: string;
  promptVersion: string;
  reviews: number;
  rated: number;
  avgRating: number | null;
};
export function normalizeRatings(raw: unknown): RatingRow[] {
  return arr(obj(raw).ratings).flatMap((r) => {
    const o = obj(r);
    const purpose = text(o.purpose);
    if (!purpose) return [];
    return [
      {
        purpose,
        variant: text(o.variant) ?? "a",
        promptVersion: text(o.promptVersion) ?? "—",
        reviews: Math.max(0, finite(o.reviews) ?? 0),
        rated: Math.max(0, finite(o.rated) ?? 0),
        avgRating: finite(o.avgRating),
      },
    ];
  });
}

export type EvalSummary = {
  createdAt: string | null;
  runs: number;
  failed: number;
  groundingRate: number | null;
  verifierRejectionRate: number | null;
  languagePurity: number | null;
  avgLatencyMs: number | null;
  costUsd: number | null;
  droppedClaims: number | null;
};
/** GET admin/ai/eval/latest → null when no eval has run yet. */
export function normalizeEval(raw: unknown): EvalSummary | null {
  const o = obj(raw);
  const s = obj(o.summary);
  if (!Object.keys(s).length) return null;
  return {
    createdAt: text(o.createdAt),
    runs: finite(s.runs) ?? 0,
    failed: finite(s.failed) ?? 0,
    groundingRate: finite(s.groundingRate),
    verifierRejectionRate: finite(s.verifierRejectionRate),
    languagePurity: finite(s.languagePurity),
    avgLatencyMs: finite(s.avgLatencyMs),
    costUsd: finite(s.costUsd),
    droppedClaims: finite(s.droppedClaims),
  };
}
