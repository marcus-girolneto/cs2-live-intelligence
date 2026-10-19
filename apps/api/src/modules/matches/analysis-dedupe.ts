import type { Logger } from "../../shared/logging/logger.js";
import type { PipelineRepository } from "./pipeline.repository.js";

/** Port: gives one job its own name for another job's stored artifact (replay, events). */
export interface ArtifactCopier {
  copy(fromJobId: string, toJobId: string): Promise<boolean>;
}

/**
 * Checksum dedupe: when a complete analysis of the same demo bytes by the current parser
 * exists (any account), a new job completes by copying it instead of parsing again. Each job
 * gets its own analysis row and its own names for the replay and events files (hard links), so
 * deleting one account's copy never affects another's.
 */
export class AnalysisDedupe {
  constructor(
    private readonly pipeline: PipelineRepository,
    private readonly replays: ArtifactCopier,
    private readonly events: ArtifactCopier,
    private readonly logger: Logger,
  ) {}

  /**
   * Completes `job` from a donor; false when there is none (or the donor's files are gone), and
   * the job is parsed normally. `leaseToken`: the worker's claim; absent for a queued job.
   */
  async tryComplete(job: {
    id: string;
    checksum?: string;
    leaseToken?: string;
  }): Promise<boolean> {
    if (!job.checksum) return false;
    const version = await this.pipeline.parserVersion();
    if (!version) return false;
    const donor = await this.pipeline.donor(job.checksum, version, job.id);
    if (!donor) return false;
    if (
      donor.eventsCount !== null &&
      !(await this.events.copy(donor.id, job.id))
    )
      return false;
    // The replay is best effort, as when parsing.
    await this.replays.copy(donor.id, job.id).catch(() => false);
    const done = await this.pipeline.completeClone(
      job.id,
      donor.id,
      job.leaseToken,
    );
    if (done)
      this.logger.info(
        { jobId: job.id, donorId: donor.id },
        "demo deduplicated",
      );
    return done;
  }
}
