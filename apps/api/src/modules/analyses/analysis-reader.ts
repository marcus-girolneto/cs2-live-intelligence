import type { AnalysisEventsStore } from "../../infrastructure/storage/events-storage.js";
import type {
  CompletedAnalysis,
  MatchDto,
  NewDemoJob,
  StoredAnalysis,
} from "../matches/matches.dto.js";
import type { MatchesRepository } from "../matches/matches.repository.js";
import type { IntegrityRepository } from "../integrity/integrity.repository.js";

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
 * (`<jobId>.events.json.gz`, LRU-cached by the store) and the match's Steam ban check
 * (`integrity.bannedAfterMatch`). Rows that still hold their events inline
 * (before the background migration) are returned unchanged; a missing file leaves `events`
 * absent, which the analysis contract allows.
 */
export class HydratingMatchesRepository
  implements MatchesRepository, AnalysisReader
{
  constructor(
    private readonly inner: MatchesRepository,
    private readonly events: Pick<AnalysisEventsStore, "read">,
    /** Per-match Steam bans, merged into `integrity.bannedAfterMatch`. */
    private readonly bans?: Pick<IntegrityRepository, "bansFor">,
  ) {}

  private async hydrate(
    id: string,
    analysis: unknown,
    bans: Awaited<ReturnType<IntegrityRepository["bansFor"]>>,
  ): Promise<unknown> {
    if (!analysis || typeof analysis !== "object") return analysis;
    let doc = analysis as Document;
    if (doc.events === undefined) {
      const events = await this.events.read(id);
      if (events) doc = { ...doc, events };
    }
    const checked = bans.get(id);
    if (checked) {
      const integrity = (doc.integrity as Document | undefined) ?? {
        players: [],
      };
      doc = {
        ...doc,
        integrity: { ...integrity, bannedAfterMatch: checked.bans },
      };
    }
    return doc;
  }

  private async bansOf(ids: string[]) {
    return this.bans?.bansFor(ids) ?? new Map();
  }

  async analysis(
    ownerId: string,
    id: string,
  ): Promise<StoredAnalysis | undefined> {
    const stored = await this.inner.analysis(ownerId, id);
    return stored
      ? {
          ...stored,
          analysis: await this.hydrate(
            id,
            stored.analysis,
            await this.bansOf([id]),
          ),
        }
      : undefined;
  }

  async completedAnalyses(
    ownerId: string,
    limit?: number,
  ): Promise<CompletedAnalysis[]> {
    const rows = await this.inner.completedAnalyses(ownerId, limit);
    const bans = await this.bansOf(rows.map((row) => row.id));
    return Promise.all(
      rows.map(async (row) => ({
        ...row,
        analysis: await this.hydrate(row.id, row.analysis, bans),
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
