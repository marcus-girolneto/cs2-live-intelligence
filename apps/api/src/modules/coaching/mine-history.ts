import type { AnalysisHistory } from "./coaching.ports.js";
import type {
  CompletedAnalysis,
  StoredAnalysis,
} from "../matches/matches.dto.js";

/** Port: job ids of the owner's own ("mine") matches. */
export interface MineMatches {
  mine(ownerId: string): Promise<Map<string, string>>;
}

/**
 * Decorator: the owner's analyses restricted to their own matches. Personal features
 * (learning, progress, personal coach, monthly reports) read through it; external matches
 * stay reviewable through the unfiltered history.
 */
export class MineOnlyHistory implements AnalysisHistory {
  constructor(
    private readonly inner: AnalysisHistory,
    private readonly ownership: MineMatches,
  ) {}
  analysis(ownerId: string, id: string): Promise<StoredAnalysis | undefined> {
    return this.inner.analysis(ownerId, id);
  }
  /** Only the own matches are loaded (their ids are filtered in SQL, then `limit` applies). */
  async completedAnalyses(
    ownerId: string,
    limit?: number,
    ids?: readonly string[],
  ): Promise<CompletedAnalysis[]> {
    const mine = await this.ownership.mine(ownerId);
    const wanted = ids ? ids.filter((id) => mine.has(id)) : [...mine.keys()];
    return this.inner.completedAnalyses(ownerId, limit, wanted);
  }
}
