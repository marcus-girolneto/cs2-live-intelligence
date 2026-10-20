import { NotFoundError } from "../../shared/errors/index.js";
import { ViewerPolicy } from "../coaching/viewer.policy.js";
import type { StoredAnalysis } from "../matches/matches.dto.js";

/** Port (matches module): an owner's completed analysis. */
export interface AnalysisReader {
  analysis(ownerId: string, id: string): Promise<StoredAnalysis | undefined>;
}

/** GET /v1/analyses/:id — the analysis with its offline coaching, redacted for non-admins. */
export class AnalysesService {
  constructor(private readonly analyses: AnalysisReader) {}

  async get(
    ownerId: string,
    id: string,
    viewer: ViewerPolicy,
  ): Promise<StoredAnalysis> {
    const stored = await this.analyses.analysis(ownerId, id);
    if (!stored) throw new NotFoundError("Analysis not found");
    const { analysis, coaching } = stored;
    return {
      id: stored.id,
      analysis,
      coaching: viewer.admin ? coaching : viewer.coaching(coaching),
    };
  }
}
