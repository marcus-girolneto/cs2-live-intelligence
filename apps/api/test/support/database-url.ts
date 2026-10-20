import { Pool } from "pg";

/**
 * Tests never touch the development database. They use TEST_DATABASE_URL, or DATABASE_URL with
 * the database name suffixed `_test` (cs2live → cs2live_test) on the same server. Each test
 * file still isolates itself in its own schema inside that database.
 */
export function testDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const explicit = env.TEST_DATABASE_URL;
  const dev = env.DATABASE_URL;
  if (!explicit && !dev) return undefined;
  const url = new URL(explicit ?? dev!);
  if (!explicit) url.pathname = `/${databaseName(url)}_test`;
  if (dev && databaseName(url) === databaseName(new URL(dev)))
    throw new Error(
      "TEST_DATABASE_URL must name a different database than DATABASE_URL",
    );
  return url.toString();
}

function databaseName(url: URL): string {
  return decodeURIComponent(url.pathname.replace(/^\//, "")) || "postgres";
}

/** Creates the test database when missing (same server, the maintenance `postgres` DB). */
export async function ensureTestDatabase(url: string): Promise<void> {
  const target = new URL(url);
  const name = databaseName(target);
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(name))
    throw new Error(`Unsupported test database name: ${name}`);
  const maintenance = new URL(url);
  maintenance.pathname = "/postgres";
  maintenance.search = "";
  const pool = new Pool({ connectionString: maintenance.toString(), max: 1 });
  try {
    const exists = await pool.query(
      "select 1 from pg_database where datname=$1",
      [name],
    );
    if (!exists.rows.length)
      await pool.query(`create database "${name}"`).catch((error: unknown) => {
        // Another process created it first.
        if ((error as { code?: string }).code !== "42P04") throw error;
      });
  } finally {
    await pool.end();
  }
}

/** Drops schemas left behind by interrupted test runs (only ever in the test database). */
export async function dropLeftoverSchemas(url: string): Promise<string[]> {
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    const r = await pool.query(
      "select nspname from pg_namespace where nspname !~ '^(pg_|information_schema$|public$)'",
    );
    const names = r.rows.map((row) => row.nspname as string);
    for (const name of names)
      await pool.query(`drop schema if exists "${name}" cascade`);
    return names;
  } finally {
    await pool.end();
  }
}
