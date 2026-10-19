/** Small defensive readers shared by the coaching mappers. */
import { finite, text } from "@/shared/format";

export const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const strs = (v: unknown) =>
  arr(v)
    .map(text)
    .filter((s): s is string => s !== null);
export const first = (o: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
};
export const opt = <K extends string, V>(key: K, value: V | null | undefined) =>
  (value === null || value === undefined ? {} : { [key]: value }) as Partial<
    Record<K, V>
  >;
/** First finite number among keys. */
export const num = (o: Record<string, unknown>, keys: string[]) =>
  finite(first(o, keys));
/** A percentage 0–100 (0–1 fractions are scaled). */
export function pct(v: unknown): number | null {
  const n = finite(v);
  if (n === null) return null;
  const p = n > 0 && n <= 1 && !Number.isInteger(n) ? n * 100 : n;
  return Math.max(0, Math.min(100, p));
}
export function point(v: unknown): { x: number; y: number } | null {
  const o = obj(v);
  if (Array.isArray(v) && v.length >= 2) {
    const x = finite(v[0]);
    const y = finite(v[1]);
    return x !== null && y !== null ? { x, y } : null;
  }
  if (!o) return null;
  const x = finite(o.x);
  const y = finite(o.y);
  return x !== null && y !== null ? { x, y } : null;
}
