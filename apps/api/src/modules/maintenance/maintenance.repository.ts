import { sql, type SQL } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";

/** Append-only tables partitioned by month on created_at. */
export const PARTITIONED_TABLES = [
  "telemetry_events",
  "product_events",
] as const;
export type PartitionedTable = (typeof PARTITIONED_TABLES)[number];
/** Tables whose old rows are deleted in batches by the data-retention job. */
export type PurgeTarget =
  | "telemetry_events"
  | "product_events"
  | "admin_audit"
  | "usage_counters"
  | "usage_live_matches"
  | "provider_usage"
  | "file_deletions";

/** One batch: the rows older than the cutoff, identified by their key (partition-safe). */
const BATCH_SQL: Record<PurgeTarget, (cutoff: string, limit: number) => SQL> = {
  telemetry_events: (cutoff, limit) =>
    sql`delete from telemetry_events where (device_id,event_id,created_at) in (select device_id,event_id,created_at from telemetry_events where created_at<${cutoff}::timestamptz limit ${limit})`,
  product_events: (cutoff, limit) =>
    sql`delete from product_events where (id,created_at) in (select id,created_at from product_events where created_at<${cutoff}::timestamptz limit ${limit})`,
  admin_audit: (cutoff, limit) =>
    sql`delete from admin_audit where id in (select id from admin_audit where created_at<${cutoff}::timestamptz limit ${limit})`,
  usage_counters: (cutoff, limit) =>
    sql`delete from usage_counters where (owner_id,day,kind) in (select owner_id,day,kind from usage_counters where day<${cutoff}::date limit ${limit})`,
  usage_live_matches: (cutoff, limit) =>
    sql`delete from usage_live_matches where (owner_id,day,match_key) in (select owner_id,day,match_key from usage_live_matches where day<${cutoff}::date limit ${limit})`,
  provider_usage: (cutoff, limit) =>
    sql`delete from provider_usage where (owner_id,day) in (select owner_id,day from provider_usage where day<${cutoff}::date limit ${limit})`,
  file_deletions: (cutoff, limit) =>
    sql`delete from file_deletions where object_key in (select object_key from file_deletions where processed_at<${cutoff}::timestamptz limit ${limit})`,
};

/** Partition maintenance and batched deletes of old rows in append-only tables. */
export interface MaintenanceRepository {
  /** Creates the monthly partitions up to `monthsAhead` months ahead; returns how many. */
  ensurePartitions(
    table: PartitionedTable,
    monthsAhead: number,
  ): Promise<number>;
  /** Drops whole partitions that end on or before `cutoff`; returns their names. */
  dropPartitionsBefore(
    table: PartitionedTable,
    cutoff: Date,
  ): Promise<string[]>;
  /** Deletes at most `limit` rows older than `cutoff`; returns how many. */
  purgeBatch(table: PurgeTarget, cutoff: Date, limit: number): Promise<number>;
}

export class PgMaintenanceRepository implements MaintenanceRepository {
  constructor(private readonly db: Db) {}

  async ensurePartitions(
    table: PartitionedTable,
    monthsAhead: number,
  ): Promise<number> {
    const r = await this.db.execute(
      sql`select ensure_month_partitions(${table}, ${monthsAhead}) as created`,
    );
    return Number(r.rows[0]?.created ?? 0);
  }

  async dropPartitionsBefore(
    table: PartitionedTable,
    cutoff: Date,
  ): Promise<string[]> {
    // Partitions are named <table>_pYYYYMM and cover one calendar month (UTC bounds).
    const r = await this.db.execute(
      sql`select n.nspname as schema,c.relname as name from pg_inherits i join pg_class c on c.oid=i.inhrelid join pg_namespace n on n.oid=c.relnamespace where i.inhparent=to_regclass(${table}) and c.relname ~ ${`^${table}_p[0-9]{6}$`}`,
    );
    const dropped: string[] = [];
    for (const row of r.rows) {
      const name = row.name as string;
      const month = /_p(\d{4})(\d{2})$/.exec(name);
      if (!month) continue;
      const end = new Date(Date.UTC(Number(month[1]), Number(month[2]), 1));
      if (end > cutoff) continue;
      await this.db.execute(
        sql`drop table if exists ${sql.identifier(row.schema as string)}.${sql.identifier(name)}`,
      );
      dropped.push(name);
    }
    return dropped;
  }

  async purgeBatch(
    table: PurgeTarget,
    cutoff: Date,
    limit: number,
  ): Promise<number> {
    const r = await this.db.execute(
      BATCH_SQL[table](cutoff.toISOString(), limit),
    );
    return r.rowCount ?? 0;
  }
}
