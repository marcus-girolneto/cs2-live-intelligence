import type { ApiConfig, JobOptions } from "../config/api-config.js";
import type { RuntimeEnv } from "../config/env.js";
import type { OfflineCoach } from "../infrastructure/ai/coaching-ai-gateway.js";
import { ProcessDemoParser } from "../infrastructure/parser/demo-parser.js";
import { FileAnalysisEventsStore } from "../infrastructure/storage/events-storage.js";
import { FsObjectStorage } from "../infrastructure/storage/object-storage.js";
import { FileReplayStorage } from "../infrastructure/storage/replay-storage.js";
import { AnalysisDedupe } from "../modules/matches/analysis-dedupe.js";
import { PgJobQueueRepository } from "../modules/matches/job-queue.repository.js";
import { PgPipelineRepository } from "../modules/matches/pipeline.repository.js";
import { PgRetentionRepository } from "../modules/matches/retention.repository.js";
import type { ConsentLookup } from "../modules/privacy/privacy.repository.js";
import type { Db } from "../shared/db/database.js";
import { silentLogger, type Logger } from "../shared/logging/logger.js";
import { DemoProcessingWorker } from "../workers/demo-processing.worker.js";
import { EventsMigrationJob } from "../workers/events-migration.worker.js";
import { ParserUpgradeJob } from "../workers/parser-upgrade.worker.js";
import { RetentionWorker } from "../workers/retention.worker.js";
import type { ScheduledJob } from "../workers/worker-scheduler.js";

/**
 * The demo pipeline over Postgres + the objects directory: processing (dedupe → sandboxed
 * parse → analytics → events to object storage), retention, parser-upgrade reprocessing and
 * the events migration. Built by the dedicated worker (src/worker.ts) and, in-process mode, by
 * the API; the API also uses the storage adapters and dedupe for uploads and reads.
 */
export function createWorkers(
  db: Db,
  options: JobOptions,
  env: RuntimeEnv,
  consent: ConsentLookup,
  coach: OfflineCoach,
  overrides: ApiConfig["overrides"] = {},
  logger: Logger = silentLogger,
) {
  const storage = new FsObjectStorage(options.storageDir);
  const replays = new FileReplayStorage(options.storageDir);
  const events = new FileAnalysisEventsStore(options.storageDir);
  const pipeline = new PgPipelineRepository(db);
  const dedupe = new AnalysisDedupe(pipeline, replays, events, logger);
  const parser =
    overrides.demoParser ??
    new ProcessDemoParser(
      options.parserBin,
      options.parserTimeoutMs,
      () => env.raw().PATH,
    );
  const maintenance: ScheduledJob[] = [
    new EventsMigrationJob(pipeline, events, logger),
  ];
  if (parser.version)
    maintenance.unshift(
      new ParserUpgradeJob(
        { version: () => parser.version!() },
        pipeline,
        storage,
        logger,
      ),
    );
  return {
    storage,
    replays,
    events,
    pipeline,
    dedupe,
    demos: new DemoProcessingWorker(
      overrides.jobQueue ?? new PgJobQueueRepository(db),
      consent,
      parser,
      storage,
      replays,
      coach,
      { events, dedupe },
    ),
    retention: new RetentionWorker(
      new PgRetentionRepository(db),
      storage,
      replays,
      events,
    ),
    maintenance,
    logger,
  };
}
