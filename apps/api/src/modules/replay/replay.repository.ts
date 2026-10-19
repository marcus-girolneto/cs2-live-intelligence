import type { StoredAnalysis } from "../matches/matches.dto.js";

/** Data the replay service needs about a completed analysis owned by the caller. */
export interface ReplayRepository {
  /** The stored analysis document, or undefined when missing or owned by someone else. */
  ownedAnalysis(
    ownerId: string,
    analysisId: string,
  ): Promise<{ analysis: unknown } | undefined>;
}

/** Adapter over the matches repository's owner-scoped analysis lookup. */
export class MatchesReplayRepository implements ReplayRepository {
  constructor(
    private readonly matches: {
      analysis(
        ownerId: string,
        id: string,
      ): Promise<StoredAnalysis | undefined>;
    },
  ) {}
  async ownedAnalysis(
    ownerId: string,
    analysisId: string,
  ): Promise<{ analysis: unknown } | undefined> {
    const row = await this.matches.analysis(ownerId, analysisId);
    return row ? { analysis: row.analysis } : undefined;
  }
}
