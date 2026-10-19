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
  async completedAnalyses(
    ownerId: string,
    limit?: number,
  ): Promise<CompletedAnalysis[]> {
    const [mine, all] = await Promise.all([
      this.ownership.mine(ownerId),
      this.inner.completedAnalyses(ownerId, limit),
    ]);
    return all.filter((a) => mine.has(a.id));
  }
}
