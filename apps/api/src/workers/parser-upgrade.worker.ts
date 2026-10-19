import type { PipelineRepository } from "../modules/matches/pipeline.repository.js";
import type { Logger } from "../shared/logging/logger.js";
import type { ScheduledJob } from "./worker-scheduler.js";

const DAY_MS = 24 * 3600_000;
/** Background re-parses queued per run (the queue runs them one by one behind fresh uploads). */
const BATCH = 500;

/** Port: the version string of the parser binary the worker runs. */
export interface ParserVersionSource {
  version(): Promise<string>;
}
/** Port: whether the stored demo of a job still exists. */
export interface DemoPresence {
  exists(objectKey: string): Promise<boolean>;
}

/**
 * Automatic reprocessing after a parser upgrade, at worker start and daily: records the
 * running parser version (dedupe and the admin status read it), then queues background
 * re-parses of complete analyses made by another parser version whose demo is still stored.
 * Idempotent (already queued or failed jobs are skipped); users keep seeing the old analysis
 * until the new one replaces it.
 */
export class ParserUpgradeJob implements ScheduledJob {
  readonly intervalMs = DAY_MS;
  constructor(
    private readonly parser: ParserVersionSource,
    private readonly pipeline: PipelineRepository,
    private readonly demos: DemoPresence,
    private readonly logger: Logger,
    private readonly batch = BATCH,
  ) {}

  async run(): Promise<void> {
    const version = await this.parser.version();
    await this.pipeline.setParserVersion(version);
    const candidates = await this.pipeline.outdated(version, this.batch);
    const present: string[] = [];
    for (const job of candidates)
      if (await this.demos.exists(job.objectKey)) present.push(job.id);
    const queued = await this.pipeline.queueReprocess(present);
    if (candidates.length)
      this.logger.info(
        { version, queued, missingSource: candidates.length - present.length },
        "parser upgrade reprocess",
      );
  }
}
