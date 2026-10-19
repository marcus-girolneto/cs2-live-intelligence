import type { ApiConfig, JobOptions } from "./config/api-config.js";
import { RuntimeEnv } from "./config/env.js";
import { CoachingAiGateway } from "./infrastructure/ai/coaching-ai-gateway.js";
import {
  createJobsContext,
  createWorkers,
  type JobsContext,
} from "./composition/jobs.js";
import {
  assertCapacities,
  createLiveContext,
  type LiveContext,
} from "./composition/live.js";
import {
  createPlatformContext,
  type PlatformContext,
} from "./composition/platform.js";
import { StaticIdentity } from "./modules/auth/identity.js";
import { PgPrivacyRepository } from "./modules/privacy/privacy.repository.js";
import type { Database } from "./shared/db/database.js";
import { silentLogger, type Logger } from "./shared/logging/logger.js";
import { AppMetrics } from "./shared/logging/metrics.js";
import { startWorkers, type WorkerHandle } from "./workers/worker-scheduler.js";

/**
 * Composition root. Builds every adapter, repository, service and controller exactly once
 * and hands them to the HTTP layer. Two shapes:
 * - database mode: Postgres repositories, account/plan/AI/admin modules, and (with `jobs`)
 *   uploads, analyses, coaching, replay and the background workers;
 * - memory mode (no database): static identities and in-process live sessions only.
 */
export interface Container {
  config: ApiConfig;
  env: RuntimeEnv;
  logger: Logger;
  metrics: AppMetrics;
  database: Database | undefined;
  live: LiveContext;
  /** Database mode only. */
  platform: PlatformContext | undefined;
  /** Database mode with `jobs` only. */
  jobs: JobsContext | undefined;
  /** Memory mode only: static tokens (logout revokes them in process). */
  staticIdentity: StaticIdentity | undefined;
}

export function createContainer(config: ApiConfig): Container {
  assertCapacities(config);
  const env = config.env ?? new RuntimeEnv();
  const logger = config.logger ?? silentLogger;
  const metrics = new AppMetrics();
  const database = config.database;
  const db = database?.db;
  const live = createLiveContext(config, db, metrics);
  let platform: PlatformContext | undefined;
  let jobs: JobsContext | undefined;
  try {
    platform = db
      ? createPlatformContext(config, db, live, env, logger)
      : undefined;
    jobs =
      db && platform && config.jobs
        ? createJobsContext(
            config,
            config.jobs,
            db,
            live,
            platform,
            env,
            logger,
          )
        : undefined;
  } catch (error) {
    live.broadcaster.close();
    throw error;
  }
  return {
    config,
    env,
    logger,
    metrics,
    database,
    live,
    platform,
    jobs,
    staticIdentity: db
      ? undefined
      : new StaticIdentity(config.owners, config.devices),
  };
}

/** Starts the demo worker and retention schedule of a jobs-enabled container. */
export async function startContainerWorkers(
  jobs: JobsContext,
  options: JobOptions,
): Promise<WorkerHandle> {
  await jobs.workers.storage.ensureReady();
  return startWorkers(
    jobs.workers.demos,
    jobs.workers.retention,
    options,
    jobs.daily,
  );
}

/**
 * Standalone worker over a database (tests and tooling): same wiring as the app's worker,
 * with its own storage adapters.
 */
export async function createWorker(
  database: Database,
  options: JobOptions,
  env: RuntimeEnv = new RuntimeEnv(),
): Promise<WorkerHandle> {
  const workers = createWorkers(
    database.db,
    options,
    env,
    new PgPrivacyRepository(database.db),
    new CoachingAiGateway(),
  );
  await workers.storage.ensureReady();
  return startWorkers(workers.demos, workers.retention, options);
}
