/** Metric series of the monthly report (trends, utility/crosshair evolution). */
import { finite, text } from "@/shared/format";

export type SeriesPoint = { label: string; value: number };
export type Series = {
  key: string;
  label: string;
  unit: string;
  better: "higher" | "lower";
  points: SeriesPoint[];
};
export type Evolution = { summary?: string; series: Series[] };
export const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const first = (o: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
};
export const num = (o: Record<string, unknown>, keys: string[]) =>
  finite(first(o, keys));
export const pct = (v: unknown) => {
  const n = finite(v);
  if (n === null) return null;
  return Math.max(0, Math.min(100, n > 0 && n < 1 ? n * 100 : n));
};

/** "2026-10-03T…" → "10/03"; other labels pass through. */
export function shortDate(v: string | null): string | null {
  const m = v && /^\d{4}-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[1]}/${m[2]}` : v;
}
const KNOWN: Record<
  string,
  { label: string; unit: string; better: "higher" | "lower" }
> = {
  adr: { label: "ADR", unit: "", better: "higher" },
  kast: { label: "KAST", unit: "%", better: "higher" },
  kd: { label: "K/D", unit: "", better: "higher" },
  rating: { label: "Rating", unit: "", better: "higher" },
  headshotPercentage: { label: "Headshot %", unit: "%", better: "higher" },
  hs: { label: "Headshot %", unit: "%", better: "higher" },
  winRate: { label: "Win rate", unit: "%", better: "higher" },
  efficiency: { label: "Utility efficiency", unit: "%", better: "higher" },
  enemiesFlashed: {
    label: "Enemies flashed / match",
    unit: "",
    better: "higher",
  },
  utilityDamage: {
    label: "Utility damage / match",
    unit: "",
    better: "higher",
  },
  medianOffset: { label: "Pre-aim offset", unit: "°", better: "lower" },
  wellPreAimed: { label: "Duels well pre-aimed", unit: "%", better: "higher" },
};

function parsePoints(v: unknown): SeriesPoint[] {
  return arr(v)
    .map((p, i): SeriesPoint | null => {
      const o = obj(p);
      const value = o ? num(o, ["value", "v", "y"]) : finite(p);
      if (value === null) return null;
      const label =
        shortDate(o && text(first(o, ["label", "date", "week", "x"]))) ??
        String(i + 1);
      return { label, value };
    })
    .filter((x): x is SeriesPoint => !!x)
    .slice(-40);
}
export function parseSeries(raw: unknown): Series[] {
  const o = obj(raw);
  const entries: [string, unknown][] = o
    ? Object.entries(o).filter(([k]) => k !== "summary")
    : arr(raw).map((s) => [String(obj(s)?.key ?? ""), s]);
  return entries
    .map(([key, v]): Series | null => {
      const s = obj(v);
      const points = parsePoints(
        Array.isArray(v) ? v : Array.isArray(s?.series) ? s.series : s?.points,
      );
      if (points.length < 2) return null;
      const known = KNOWN[key];
      return {
        key: key || String(text(s?.label) ?? "series"),
        label: text(s?.label) ?? known?.label ?? key,
        unit: text(s?.unit) ?? known?.unit ?? "",
        better: s?.better === "lower" ? "lower" : (known?.better ?? "higher"),
        points,
      };
    })
    .filter((x): x is Series => !!x)
    .slice(0, 6);
}
export function parseEvolution(raw: unknown): Evolution | null {
  const o = obj(raw);
  if (!o) return null;
  const series = parseSeries(
    obj(o.series) || Array.isArray(o.series) ? o.series : o,
  );
  const summary = text(o.summary);
  if (!series.length && !summary) return null;
  return { ...(summary ? { summary } : {}), series };
}
/** Change from the first to the last point, signed so that positive = improvement. */
export function seriesDelta(s: Series) {
  const a = s.points[0]!.value;
  const b = s.points.at(-1)!.value;
  const d = b - a;
  return { delta: d, good: s.better === "lower" ? d < 0 : d > 0, last: b };
}
