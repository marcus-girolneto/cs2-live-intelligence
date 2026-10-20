import {
  dropLeftoverSchemas,
  ensureTestDatabase,
  testDatabaseUrl,
} from "./database-url.js";

/**
 * Vitest global setup: creates the dedicated test database (cs2live_test by default) on the
 * DATABASE_URL server and drops schemas left by interrupted runs. Without DATABASE_URL and
 * TEST_DATABASE_URL the Postgres suites are skipped.
 */
export default async function setup(): Promise<void> {
  const url = testDatabaseUrl();
  if (!url) return;
  await ensureTestDatabase(url);
  await dropLeftoverSchemas(url);
  process.env.TEST_DATABASE_URL = url;
}
