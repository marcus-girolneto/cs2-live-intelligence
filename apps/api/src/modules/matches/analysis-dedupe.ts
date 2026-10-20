import type { Logger } from "../../shared/logging/logger.js";
import type { PipelineRepository } from "./pipeline.repository.js";

/**
 * Checksum dedupe: when the same demo bytes were already parsed by the current parser (any
 * account), a new upload completes by pointing at that match: nothing is copied. The match and
 * its files are shared and reference counted (deleted once no upload points at them), so
 * deleting one account's upload never affects another's.
 */
export class AnalysisDedupe {
  constructor(
    private readonly pipeline: Pick<
      PipelineRepository,
      "parserVersion" | "linkExisting"
    >,
    private readonly logger: Logger,
  ) {}

  /**
   * Completes the upload `job.id` from an existing match; false when there is none (it is then
   * parsed normally). `leaseToken`: the worker's claim; absent for a queued job.
   */
  async tryComplete(job: {
    id: string;
    checksum?: string;
    leaseToken?: string;
  }): Promise<boolean> {
    if (!job.checksum) return false;
    const version = await this.pipeline.parserVersion();
    if (!version) return false;
    const matchId = await this.pipeline.linkExisting(
      job.id,
      version,
      job.leaseToken,
    );
    if (matchId)
      this.logger.info({ jobId: job.id, matchId }, "demo deduplicated");
    return !!matchId;
  }
}
