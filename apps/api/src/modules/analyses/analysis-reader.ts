import type { AnalysisStore } from "../../infrastructure/storage/analysis-storage.js";
import type { AnalysisEventsStore } from "../../infrastructure/storage/events-storage.js";
import type {
  CompletedAnalysis,
  MatchDto,
  NewDemoJob,
  StoredAnalysis,
} from "../matches/matches.dto.js";
import type {
  MatchesRepository,
  MatchRow,
} from "../matches/matches.repository.js";
import type { IntegrityRepository } from "../integrity/integrity.repository.js";

/**
 * Port: the one way to read a stored analysis. Every reader (analysis view, coaching and deep
 * modules, reel, replay, personal coach aggregates, reports) gets the same full document: the
 * match's analysis and `events` from object storage, plus the Steam ban check.
 */
export interface AnalysisReader {
  analysis(ownerId: string, id: string): Promise<StoredAnalysis | undefined>;
  completedAnalyses(
    ownerId: string,
    limit?: number,
    ids?: readonly string[],
  ): Promise<CompletedAnalysis[]>;
}

type Document = Record<string, unknown>;
type Bans = Awaited<ReturnType<IntegrityRepository["bansFor"]>>;

/**
 * Decorator over the matches repository that builds the full analysis of an upload from its
 * match: `<matchId>.analysis.json.gz` and `<matchId>.events.json.gz` (both LRU-cached by their
 * stores) and the match's Steam ban check (`integrity.bannedAfterMatch`). A missing analysis
 * file falls back to the slim summary with no players; a missing events file leaves `events`
 * absent, which the analysis contract allows.
 */
export class HydratingMatchesRepository
  implements MatchesRepository, AnalysisReader
{
  constructor(
    private readonly inner: MatchesRepository,
    private readonly analyses: Pick<AnalysisStore, "read">,
    private readonly events: Pick<AnalysisEventsStore, "read">,
    /** Per-match Steam bans, merged into `integrity.bannedAfterMatch`. */
    private readonly bans?: Pick<IntegrityRepository, "bansFor">,
  ) {}

  private async document(row: MatchRow, bans: Bans): Promise<Document> {
    const [stored, events] = await Promise.all([
      this.analyses.read(row.matchId),
      this.events.read(row.matchId),
    ]);
    let doc: Document = stored ?? {
      ...row.summary,
      players: [],
      evidence: [],
    };
    if (events) doc = { ...doc, events };
    const checked = bans.get(row.id);
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

  private async bansOf(ids: string[]): Promise<Bans> {
    return this.bans?.bansFor(ids) ?? new Map();
  }

  async analysis(
    ownerId: string,
    id: string,
  ): Promise<StoredAnalysis | undefined> {
    const row = await this.inner.matchRow(ownerId, id);
    if (!row) return undefined;
    return {
      id: row.id,
      analysis: await this.document(row, await this.bansOf([row.id])),
      coaching: row.coaching,
    };
  }

  async completedAnalyses(
    ownerId: string,
    limit?: number,
    ids?: readonly string[],
  ): Promise<CompletedAnalysis[]> {
    const rows = await this.inner.completedRows(ownerId, limit, ids);
    const bans = await this.bansOf(rows.map((row) => row.id));
    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        filename: row.filename,
        analysis: await this.document(row, bans),
        createdAt: row.createdAt,
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
  matchRow(ownerId: string, id: string): Promise<MatchRow | undefined> {
    return this.inner.matchRow(ownerId, id);
  }
  completedRows(
    ownerId: string,
    limit?: number,
    ids?: readonly string[],
  ): Promise<MatchRow[]> {
    return this.inner.completedRows(ownerId, limit, ids);
  }
  matchIdOf(uploadId: string): Promise<string | undefined> {
    return this.inner.matchIdOf(uploadId);
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

/**
 * Replay artifacts are stored per match; callers address them by upload (analysis) id after
 * checking ownership. Adapts a match-keyed replay store to upload ids.
 */
export class UploadReplays<T> {
  constructor(
    private readonly matches: Pick<MatchesRepository, "matchIdOf">,
    private readonly replays: { read(matchId: string): Promise<T | undefined> },
  ) {}
  async read(uploadId: string): Promise<T | undefined> {
    const matchId = await this.matches.matchIdOf(uploadId);
    return matchId ? this.replays.read(matchId) : undefined;
  }
}
