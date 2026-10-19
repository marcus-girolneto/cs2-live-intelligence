import type {
  DemoProcessingWorker,
  WorkerCounters,
} from "./demo-processing.worker.js";
import type { RetentionWorker } from "./retention.worker.js";

/** A periodic job run at startup and hourly (credits and reports). */
export interface PeriodicJob {
  run(): Promise<void>;
}

export interface WorkerOptions {
  workerIntervalMs?: number;
  disableWorker?: boolean;
}
/** Handle returned to the app and tests: run on demand, read counters, stop. */
export interface WorkerHandle {
  runOnce(): Promise<void>;
  cleanup(): Promise<void>;
  /** Runs the hourly account jobs now (tests). */
  daily(): Promise<void>;
  counters: WorkerCounters;
  stop(): Promise<void>;
}

const RETENTION_INTERVAL_MS = 3600000;

/**
 * Polls the queue (default every second) and runs retention hourly. Startup runs retention
 * once (awaited) and kicks one job. `disableWorker` leaves both to explicit calls (tests).
 */
export async function startWorkers(
  demos: DemoProcessingWorker,
  retention: RetentionWorker,
  options: WorkerOptions,
  periodic?: PeriodicJob,
): Promise<WorkerHandle> {
  const cleanup = (): Promise<void> => retention.run();
  const daily = (): Promise<void> => periodic?.run() ?? Promise.resolve();
  const poll = options.disableWorker
    ? undefined
    : setInterval(() => void demos.runOnce(), options.workerIntervalMs ?? 1000);
  poll?.unref();
  const hourly = options.disableWorker
    ? undefined
    : setInterval(() => {
        void cleanup().catch(() => {
          demos.counters.errors++;
        });
        void daily().catch(() => {
          demos.counters.errors++;
        });
      }, RETENTION_INTERVAL_MS);
  hourly?.unref();
  if (!options.disableWorker) {
    await cleanup();
    void demos.runOnce();
    void daily().catch(() => {
      demos.counters.errors++;
    });
  }
  return {
    runOnce: () => demos.runOnce(),
    cleanup,
    daily,
    counters: demos.counters,
    async stop() {
      if (poll) clearInterval(poll);
      if (hourly) clearInterval(hourly);
      await demos.stop();
    },
  };
}
