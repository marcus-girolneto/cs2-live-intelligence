import type {
  DemoProcessingWorker,
  WorkerCounters,
} from "./demo-processing.worker.js";
import type { RetentionWorker } from "./retention.worker.js";

/** A periodic job run at startup and hourly (credits and reports). */
export interface PeriodicJob {
  run(): Promise<void>;
}
/** A background maintenance job of the demo worker with its own cadence. */
export interface ScheduledJob extends PeriodicJob {
  readonly intervalMs: number;
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
  /** Runs every maintenance job once now (tests). */
  maintenance(): Promise<void>;
  counters: WorkerCounters;
  stop(): Promise<void>;
}

const RETENTION_INTERVAL_MS = 3600000;

function every(ms: number, run: () => void): NodeJS.Timeout {
  const timer = setInterval(run, ms);
  timer.unref();
  return timer;
}

/**
 * Polls the queue (default every second) and runs retention hourly. Startup runs retention
 * once (awaited) and kicks one job; maintenance jobs (parser-upgrade reprocessing, events
 * migration) start in the background and repeat at their own interval. `disableWorker` leaves
 * everything to explicit calls (tests).
 */
export async function startWorkers(
  demos: DemoProcessingWorker,
  retention: RetentionWorker,
  options: WorkerOptions,
  periodic?: PeriodicJob,
  maintenanceJobs: ScheduledJob[] = [],
): Promise<WorkerHandle> {
  const failed = (): void => {
    demos.counters.errors++;
  };
  const cleanup = (): Promise<void> => retention.run();
  const daily = (): Promise<void> => periodic?.run() ?? Promise.resolve();
  const maintenance = async (): Promise<void> => {
    for (const job of maintenanceJobs) await job.run();
  };
  const timers: NodeJS.Timeout[] = [];
  if (!options.disableWorker) {
    timers.push(
      every(options.workerIntervalMs ?? 1000, () => void demos.runOnce()),
      every(RETENTION_INTERVAL_MS, () => {
        void cleanup().catch(failed);
        void daily().catch(failed);
      }),
      ...maintenanceJobs.map((job) =>
        every(job.intervalMs, () => void job.run().catch(failed)),
      ),
    );
    await cleanup();
    void demos.runOnce();
    void daily().catch(failed);
    void maintenance().catch(failed);
  }
  return {
    runOnce: () => demos.runOnce(),
    cleanup,
    daily,
    maintenance,
    counters: demos.counters,
    async stop() {
      for (const timer of timers) clearInterval(timer);
      await demos.stop();
    },
  };
}

/**
 * The API's share when demos are processed by the dedicated worker service: only the hourly
 * account jobs (credits, reports, Personal Coach), which need the AI provider and the internet.
 */
export function startAccountJobs(
  periodic: PeriodicJob | undefined,
  options: WorkerOptions,
): WorkerHandle {
  const counters: WorkerCounters = { complete: 0, failed: 0, errors: 0 };
  const daily = (): Promise<void> => periodic?.run() ?? Promise.resolve();
  const failed = (): void => {
    counters.errors++;
  };
  const timer = options.disableWorker
    ? undefined
    : every(RETENTION_INTERVAL_MS, () => void daily().catch(failed));
  if (!options.disableWorker) void daily().catch(failed);
  const idle = (): Promise<void> => Promise.resolve();
  return {
    runOnce: idle,
    cleanup: idle,
    daily,
    maintenance: idle,
    counters,
    async stop() {
      if (timer) clearInterval(timer);
    },
  };
}
