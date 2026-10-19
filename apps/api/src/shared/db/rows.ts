/** Row-mapping helpers for raw `db.execute` results. */
export type Row = Record<string, unknown>;

/** ISO-8601 string of a timestamp column. */
export const isoDate = (value: unknown): string =>
  new Date(value as string).toISOString();

/** ISO-8601 string, or null for a null column. */
export const isoOrNull = (value: unknown): string | null =>
  value ? isoDate(value) : null;

export const stringOrNull = (value: unknown): string | null =>
  (value as string | null | undefined) ?? null;
