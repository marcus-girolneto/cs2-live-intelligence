import type {
  DemoProcessingWorker,
  WorkerCounters,
} from "./demo-processing.worker.js";
import type { RetentionWorker } from "./retention.worker.js";

export interface WorkerOptions {
  workerIntervalMs?: number;
  disableWorker?: boolean;
}
/** Handle returned to the app and tests: run on demand, read counters, stop. */
export interface WorkerHandle {
  runOnce(): Promise<void>;
  cleanup(): Promise<void>;
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
): Promise<WorkerHandle> {
  const cleanup = (): Promise<void> => retention.run();
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
      }, RETENTION_INTERVAL_MS);
  hourly?.unref();
  if (!options.disableWorker) {
    await cleanup();
    void demos.runOnce();
  }
  return {
    runOnce: () => demos.runOnce(),
    cleanup,
    counters: demos.counters,
    async stop() {
      if (poll) clearInterval(poll);
      if (hourly) clearInterval(hourly);
      await demos.stop();
    },
  };
}
