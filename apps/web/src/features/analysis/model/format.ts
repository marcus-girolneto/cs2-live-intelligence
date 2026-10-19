export const secs = (v: number | null | undefined, locale: string) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? null
    : `${v.toLocaleString(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}s`;

/* ------------------------------------------------------------- weapons */
