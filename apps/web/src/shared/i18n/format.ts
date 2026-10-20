// Intl formatters for the active locale: numbers, percentages, dates, relative time and
// money always follow the user's language (no hand-made decimal commas).
const cache = new Map<string, Intl.NumberFormat>();
function nf(locale: string, options: Intl.NumberFormatOptions) {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, options);
    cache.set(key, f);
  }
  return f;
}
const finite = (v: number | null | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v);

export type Formatters = ReturnType<typeof createFormatters>;

export function createFormatters(locale: string) {
  return {
    /** 1234.5 → "1,234.5" / "1.234,5" / "1 234,5"; null → "–". */
    number(v: number | null | undefined, digits = 0, minDigits = 0) {
      return finite(v)
        ? nf(locale, {
            maximumFractionDigits: digits,
            minimumFractionDigits: Math.min(minDigits, digits),
          }).format(v)
        : "–";
    },
    /** A value already in percent (42.5 → "42.5%", "42,5 %"). */
    percent(v: number | null | undefined, digits = 0) {
      return finite(v)
        ? nf(locale, {
            style: "percent",
            maximumFractionDigits: digits,
          }).format(v / 100)
        : "–";
    },
    /** Minor units of a currency (999, "USD" → "$9.99"). */
    currency(cents: number | null | undefined, currency: string, digits = 2) {
      return finite(cents)
        ? nf(locale, {
            style: "currency",
            currency,
            minimumFractionDigits:
              cents % 100 === 0 && digits === 0 ? 0 : digits,
            maximumFractionDigits: digits,
          }).format(cents / 100)
        : "–";
    },
    date(
      v: string | number | Date | null | undefined,
      style: "short" | "medium" | "long" = "medium",
    ) {
      if (v === null || v === undefined) return "–";
      const d = new Date(v);
      return Number.isNaN(d.getTime())
        ? "–"
        : new Intl.DateTimeFormat(locale, { dateStyle: style }).format(d);
    },
    dateTime(v: string | number | Date | null | undefined) {
      if (v === null || v === undefined) return "–";
      const d = new Date(v);
      return Number.isNaN(d.getTime())
        ? "–"
        : new Intl.DateTimeFormat(locale, {
            dateStyle: "short",
            timeStyle: "short",
          }).format(d);
    },
    /** "3 days ago" / "in 2 hours" from a date (now = Date.now()). */
    relative(v: string | number | Date | null | undefined, now = Date.now()) {
      if (v === null || v === undefined) return "–";
      const t = new Date(v).getTime();
      if (Number.isNaN(t)) return "–";
      const s = (t - now) / 1000;
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
      const units: [Intl.RelativeTimeFormatUnit, number][] = [
        ["year", 31536000],
        ["month", 2592000],
        ["week", 604800],
        ["day", 86400],
        ["hour", 3600],
        ["minute", 60],
      ];
      for (const [unit, size] of units)
        if (Math.abs(s) >= size) return rtf.format(Math.round(s / size), unit);
      return rtf.format(Math.round(s), "second");
    },
  };
}
