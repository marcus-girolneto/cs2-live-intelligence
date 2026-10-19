import type { AnalysisEventsStore } from "../../infrastructure/storage/events-storage.js";
import type {
  CompletedAnalysis,
  MatchDto,
  NewDemoJob,
  StoredAnalysis,
} from "../matches/matches.dto.js";
import type { MatchesRepository } from "../matches/matches.repository.js";

/**
 * Port: the one way to read a stored analysis. Every reader (analysis view, coaching and deep
 * modules, reel, replay, personal coach aggregates, reports) gets the same full document:
 * the summary from Postgres plus the `events` array from object storage.
 */
export interface AnalysisReader {
  analysis(ownerId: string, id: string): Promise<StoredAnalysis | undefined>;
  completedAnalyses(
    ownerId: string,
    limit?: number,
  ): Promise<CompletedAnalysis[]>;
}

type Document = Record<string, unknown>;

/**
 * Decorator over the matches repository that re-attaches the events moved out of Postgres
 * (`<jobId>.events.json.gz`, LRU-cached by the store). Rows that still hold their events inline
 * (before the background migration) are returned unchanged; a missing file leaves `events`
 * absent, which the analysis contract allows.
 */
export class HydratingMatchesRepository
  implements MatchesRepository, AnalysisReader
{
  constructor(
    private readonly inner: MatchesRepository,
    private readonly events: Pick<AnalysisEventsStore, "read">,
  ) {}

  private async hydrate(id: string, analysis: unknown): Promise<unknown> {
    if (!analysis || typeof analysis !== "object") return analysis;
    const doc = analysis as Document;
    if (doc.events !== undefined) return analysis;
    const events = await this.events.read(id);
    return events ? { ...doc, events } : analysis;
  }

  async analysis(
    ownerId: string,
    id: string,
  ): Promise<StoredAnalysis | undefined> {
    const stored = await this.inner.analysis(ownerId, id);
    return stored
      ? { ...stored, analysis: await this.hydrate(id, stored.analysis) }
      : undefined;
  }

  async completedAnalyses(
    ownerId: string,
    limit?: number,
  ): Promise<CompletedAnalysis[]> {
    const rows = await this.inner.completedAnalyses(ownerId, limit);
    return Promise.all(
      rows.map(async (row) => ({
        ...row,
        analysis: await this.hydrate(row.id, row.analysis),
      })),
    );
  }

  createJob(
    ownerId: string,
    file: NewDemoJob,
  ): Promise<{ id: string; status: "queued" }> {
    return this.inner.createJob(ownerId, file);
  }
  list(ownerId: string): Promise<MatchDto[]> {
    return this.inner.list(ownerId);
  }
  find(ownerId: string, id: string): Promise<MatchDto | undefined> {
    return this.inner.find(ownerId, id);
  }
  reprocessCandidates(
    ownerId?: string,
  ): Promise<{ id: string; objectKey: string }[]> {
    return this.inner.reprocessCandidates(ownerId);
  }
  requeue(ids: string[]): Promise<number> {
    return this.inner.requeue(ids);
  }
}
