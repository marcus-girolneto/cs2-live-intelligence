import type { ObjectStorage } from "../../infrastructure/storage/object-storage.js";
import { NotFoundError } from "../../shared/errors/index.js";
import type { Logger } from "../../shared/logging/logger.js";
import type { AuditTrail } from "../../shared/ports/audit-trail.js";
import type {
  MatchDto,
  MatchListDto,
  ReprocessResultDto,
  ReprocessStatusDto,
} from "./matches.dto.js";
import type { MatchesRepository } from "./matches.repository.js";
import type { PipelineRepository } from "./pipeline.repository.js";

/** Owner-scoped match listing and the admin "re-run stored demos" operation. */
export class MatchesService {
  constructor(
    private readonly matches: MatchesRepository,
    private readonly storage: ObjectStorage,
    private readonly audit: AuditTrail,
    private readonly logger: Logger,
    private readonly pipeline?: Pick<
      PipelineRepository,
      "parserVersion" | "reprocessStatus"
    >,
  ) {}

  /**
   * Progress of the automatic re-parse after a parser upgrade: analyses still made by an older
   * parser (pending), by the current one (done) and background re-parses that failed.
   */
  async reprocessStatus(): Promise<ReprocessStatusDto> {
    const currentVersion = (await this.pipeline?.parserVersion()) ?? null;
    if (!this.pipeline || !currentVersion)
      return { pending: 0, done: 0, failed: 0, currentVersion };
    return {
      ...(await this.pipeline.reprocessStatus(currentVersion)),
      currentVersion,
    };
  }

  async list(ownerId: string): Promise<MatchListDto> {
    return { matches: await this.matches.list(ownerId) };
  }

  async get(ownerId: string, id: string): Promise<MatchDto> {
    const match = await this.matches.find(ownerId, id);
    if (!match) throw new NotFoundError("Match not found");
    return match;
  }

  /** Re-queues finished jobs whose source demo is still stored (current parser + analytics). */
  async reprocess(
    adminId: string,
    ownerId?: string,
  ): Promise<ReprocessResultDto> {
    const candidates = await this.matches.reprocessCandidates(ownerId);
    const present: string[] = [];
    for (const job of candidates)
      if (await this.storage.exists(job.objectKey)) present.push(job.id);
    const queued = await this.matches.requeue(present);
    await this.audit.record(adminId, "analyses.reprocess", {
      ownerId: ownerId ?? null,
      candidates: candidates.length,
      queued,
      missingSource: candidates.length - present.length,
    });
    this.logger.info(
      { queued, ownerId: ownerId ?? "all" },
      "reprocess analyses",
    );
    return { queued };
  }
}
