import { readFile, readdir } from "node:fs/promises";
import type { Pool } from "pg";

const MIGRATION_LOCK = 726221001;
const DIRECTORY = new URL("../../../migrations/", import.meta.url);

/** Applies apps/api/migrations/*.sql in name order, once each, inside one locked transaction. */
export class Migrator {
  constructor(
    private readonly pool: Pool,
    private readonly directory: URL = DIRECTORY,
  ) {}
  async migrate(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT pg_advisory_xact_lock(${MIGRATION_LOCK})`);
      await client.query(
        "CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
      );
      const files = (await readdir(this.directory))
        .filter((name) => name.endsWith(".sql"))
        .sort();
      for (const filename of files) {
        const applied = await client.query(
          "SELECT version FROM schema_migrations WHERE version=$1",
          [filename],
        );
        if (applied.rows.length) continue;
        await client.query(
          await readFile(new URL(filename, this.directory), "utf8"),
        );
        await client.query(
          "INSERT INTO schema_migrations(version) VALUES($1)",
          [filename],
        );
      }
      // Monthly partitions of the append-only tables: this month and the next two (idempotent).
      await client.query(
        "SELECT ensure_month_partitions('telemetry_events', 2), ensure_month_partitions('product_events', 2)",
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
