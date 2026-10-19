import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, RuntimeEnv } from "./config/env.js";
import { createWorker } from "./container.js";
import { Database } from "./shared/db/database.js";
import type { Logger } from "./shared/logging/logger.js";

/**
 * Bootstrap of the dedicated demo worker service (compose `worker`): it parses untrusted demos
 * in a sandboxed container without internet access (Postgres-only network, read-only root
 * filesystem, no capabilities). It runs demo processing, retention, parser-upgrade
 * reprocessing and the events migration; the API (DEMO_WORKER=external) runs none of them.
 */
const logger: Logger = {
  info: (fields, message) =>
    console.log(
      JSON.stringify({ time: new Date().toISOString(), message, ...fields }),
    ),
};
const HEARTBEAT = join(tmpdir(), "worker-heartbeat");

const config = loadConfig();
if (!config.databaseUrl)
  throw new Error("DATABASE_URL required for the worker");
const database = new Database(config.databaseUrl);
await database.migrate();
const worker = await createWorker(
  database,
  {
    storageDir: config.storageDir,
    parserBin: config.parserBin,
    maxUploadBytes: config.maxUploadBytes,
  },
  new RuntimeEnv(),
  logger,
);
// Liveness for the container healthcheck (the root filesystem is read-only; /tmp is tmpfs).
const beat = (): void =>
  void writeFile(HEARTBEAT, String(Date.now())).catch(() => undefined);
beat();
setInterval(beat, 10_000).unref();
logger.info({ storage: config.storageDir }, "demo worker started");

let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    void (async () => {
      await worker.stop();
      await database.close();
      logger.info({}, "demo worker stopped");
      process.exit(0);
    })();
  });
// Keeps the event loop alive between polls (the scheduler timers are unref'd).
setInterval(() => undefined, 1 << 30);
