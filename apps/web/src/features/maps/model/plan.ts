/** Coaching plan items ("what to do next match"), general or specific to one map. */
import { text } from "@/shared/format";

export type Scope = "general" | "map";
export type PlanItem = { text: string; scope: Scope; map?: string };

const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strs = (v: unknown) =>
  arr(v)
    .map(text)
    .filter((s): s is string => s !== null);

export const scopeOf = (v: unknown): Scope => (v === "map" ? "map" : "general");

/** Plan items: prefers `planItems` (with scope) and falls back to the legacy `plan` strings. */
export function parsePlan(raw: Record<string, unknown> | null): PlanItem[] {
  if (!raw) return [];
  const items = arr(raw.planItems)
    .map((v): PlanItem | null => {
      const o = obj(v);
      const s = o ? text(o.text) : text(v);
      if (!s) return null;
      const map = o ? text(o.map) : null;
      return { text: s, scope: scopeOf(o?.scope), ...(map ? { map } : {}) };
    })
    .filter((p): p is PlanItem => !!p);
  if (items.length) return items;
  return strs(raw.plan).map((s) => ({ text: s, scope: "general" as const }));
}

/** Splits a list into general items and items specific to the review's map. */
export function byScope<T extends { scope: Scope }>(items: T[]) {
  return {
    general: items.filter((i) => i.scope !== "map"),
    map: items.filter((i) => i.scope === "map"),
  };
}
