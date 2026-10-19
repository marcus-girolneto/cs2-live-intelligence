import { Pool } from "pg";
import { sql } from "drizzle-orm";
import { drizzle, type NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgDatabase } from "drizzle-orm/pg-core";
import * as schema from "./schema.js";
import { Migrator } from "./migrator.js";

/**
 * SQL executor shared by every Pg repository: the pool-backed database or an open
 * transaction (PgTransaction extends PgDatabase), so a repository can join a unit of work.
 */
export type Db = PgDatabase<NodePgQueryResultHKT, typeof schema>;

/** Owns the connection pool. One per process; closed on shutdown. */
export class Database {
  readonly pool: Pool;
  readonly db: Db;
  constructor(url: string) {
    this.pool = new Pool({
      connectionString: url,
      max: 10,
      connectionTimeoutMillis: 5000,
    });
    this.db = drizzle(this.pool, { schema });
  }
  /** Applies pending SQL migrations (serialized across instances by an advisory lock). */
  migrate(): Promise<void> {
    return new Migrator(this.pool).migrate();
  }
  async ready(): Promise<void> {
    await this.db.execute(sql`select 1`);
  }
  async close(): Promise<void> {
    await this.pool.end();
  }
}
