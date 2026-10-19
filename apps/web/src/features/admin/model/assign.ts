/** Pure helpers of the per-purpose model assignment screen. */
import {
  PURPOSE_FALLBACK,
  type Assignments,
  type Purpose,
  type PurposeStatus,
} from "./types";

/** Price per 1M tokens in USD, when the provider publishes it. */
export type ModelPrice = { input: number; output: number };
export type ModelInfo = { id: string; price: ModelPrice | null };
export type ModelCatalog = {
  /** False when the provider has no model list (manual entry). */
  listed: boolean;
  models: ModelInfo[];
  error: string | null;
};

const num = (v: unknown) => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
};
/**
 * Model prices arrive per token (OpenRouter: `pricing.prompt` as a string) or per 1M
 * tokens (`inputPer1M`). Normalised to USD per 1M tokens.
 */
function priceOf(o: Record<string, unknown>): ModelPrice | null {
  const p = (o.pricing ?? o.price ?? null) as Record<string, unknown> | null;
  if (p && typeof p === "object") {
    const perM = num(p.inputPer1M) !== null || num(p.outputPer1M) !== null;
    const input = perM ? num(p.inputPer1M) : num(p.prompt ?? p.input);
    const output = perM ? num(p.outputPer1M) : num(p.completion ?? p.output);
    if (input === null || output === null) return null;
    return perM
      ? { input, output }
      : { input: input * 1e6, output: output * 1e6 };
  }
  return null;
}

/** GET admin/ai/providers/:id/models → ids (+ prices), tolerant to both shapes. */
export function normalizeModels(raw: unknown): ModelCatalog {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const list = Array.isArray(o.models) ? o.models : [];
  const seen = new Set<string>();
  const models: ModelInfo[] = [];
  for (const m of list) {
    const mo = (m && typeof m === "object" ? m : {}) as Record<string, unknown>;
    const id =
      typeof m === "string" ? m : typeof mo.id === "string" ? mo.id : null;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    models.push({ id, price: typeof m === "string" ? null : priceOf(mo) });
  }
  return {
    listed: o.supported !== false && models.length > 0,
    models,
    error: typeof o.error === "string" ? o.error : null,
  };
}

/** Typical token budget of one call per purpose (for the cost estimate). */
export const TOKEN_BUDGET: Record<Purpose, { input: number; output: number }> =
  {
    review_quick: { input: 12_000, output: 1_500 },
    review_deep: { input: 30_000, output: 4_000 },
    live: { input: 2_000, output: 200 },
    report: { input: 40_000, output: 3_000 },
    personal_coach: { input: 60_000, output: 4_000 },
  };

/** Estimated USD per call at list price; null when the price is unknown. */
export function estimateCost(purpose: Purpose, price: ModelPrice | null) {
  if (!price) return null;
  const b = TOKEN_BUDGET[purpose];
  return (b.input * price.input + b.output * price.output) / 1e6;
}

export type ModelCheck = "ok" | "empty" | "unknown" | "manual";
/** "unknown" = the provider published a list and the model is not in it. */
export function checkModel(
  model: string,
  catalog: ModelCatalog | undefined,
): ModelCheck {
  const m = model.trim();
  if (!m) return "empty";
  if (!catalog || !catalog.listed) return "manual";
  return catalog.models.some((x) => x.id === m) ? "ok" : "unknown";
}

export type Effective =
  | { kind: "own" }
  | { kind: "fallback"; from: Purpose }
  | { kind: "env" }
  | { kind: "none" };
/**
 * What a purpose actually runs on: its own assignment, the assignment it falls back to,
 * or the .env defaults (from ai/status when the API reports it).
 */
export function effectiveSource(
  p: Purpose,
  assignments: Assignments,
  status?: PurposeStatus,
): Effective {
  const own = (q: Purpose) =>
    assignments[q] ?? (q === "review_quick" ? assignments.review : undefined);
  if (own(p)) return { kind: "own" };
  for (let q = PURPOSE_FALLBACK[p]; q; q = PURPOSE_FALLBACK[q])
    if (own(q)) return { kind: "fallback", from: q };
  if (status?.source === "env" || status?.configured) return { kind: "env" };
  return status ? { kind: "none" } : { kind: "env" };
}
