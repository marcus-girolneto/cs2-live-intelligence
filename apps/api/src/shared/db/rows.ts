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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** True for a canonical UUID string (ids of uploads, reviews, reports, providers…). */
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID.test(value);
/**
 * A caller-supplied id for a `uuid` column: the id itself, or null when it is not a UUID (so
 * `where id = $1` matches nothing instead of failing with "invalid input syntax for type uuid").
 */
export const uuidOrNull = (value: string | null | undefined): string | null =>
  isUuid(value) ? value : null;
/** The UUIDs of a caller-supplied id list (others can never match a `uuid` column). */
export const uuidsOnly = (values: readonly string[]): string[] =>
  values.filter(isUuid);
