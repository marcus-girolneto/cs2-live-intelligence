// Every value rendered on screen passes through here: anything that is not a
// real finite number (null, undefined, NaN, Infinity) becomes null so the UI
// can show an explicit "no data" state instead of NaN.
export function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
export function formatNumber(
  value: unknown,
  digits = 0,
  locale = "en-US",
): string | null {
  const n = finite(value);
  return n === null
    ? null
    : n.toLocaleString(locale, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
}
export function ratio(a: unknown, b: unknown): number | null {
  const x = finite(a);
  const y = finite(b);
  return x === null || y === null || y === 0 ? null : x / y;
}
export function formatDate(value: unknown, locale = "en-US"): string | null {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isFinite(time)
    ? new Date(time).toLocaleString(locale, {
        dateStyle: "short",
        timeStyle: "short",
      })
    : null;
}
export function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
export const MAP_NAMES: Record<string, string> = {
  de_mirage: "Mirage",
  de_dust2: "Dust II",
  de_inferno: "Inferno",
  de_nuke: "Nuke",
  de_ancient: "Ancient",
  de_anubis: "Anubis",
  de_vertigo: "Vertigo",
  de_overpass: "Overpass",
  de_train: "Train",
};
export function mapName(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  return (
    MAP_NAMES[raw] ??
    raw.replace(/^[a-z]+_/, "").replace(/^\w/, (c) => c.toUpperCase())
  );
}
