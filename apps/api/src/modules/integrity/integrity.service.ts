import { integritySchema, type Integrity } from "@cs2/contracts";
import { NotFoundError } from "../../shared/errors/index.js";
import type { StoredAnalysis } from "../matches/matches.dto.js";
import type { IntegrityRepository } from "./integrity.repository.js";

export type IntegrityDto = Integrity & {
  bannedAfterMatch: NonNullable<Integrity["bannedAfterMatch"]>;
  /** Last Steam ban check (null until the first check ran). */
  checkedAt: string | null;
};

/** Port (matches module): the caller's own completed analysis. */
export interface OwnedAnalysis {
  analysis(ownerId: string, id: string): Promise<StoredAnalysis | undefined>;
}

/**
 * GET /v1/analyses/:id/integrity: the match's integrity signals and Steam bans, for the
 * uploader of that match only (owner-scoped lookup; 404 for anyone else). Statistical
 * observations, never an accusation (docs/INTEGRITY.md).
 */
export class IntegrityService {
  constructor(
    private readonly analyses: OwnedAnalysis,
    private readonly repository: Pick<IntegrityRepository, "bansFor">,
  ) {}

  async view(ownerId: string, id: string): Promise<IntegrityDto> {
    const stored = await this.analyses.analysis(ownerId, id);
    if (!stored) throw new NotFoundError("Analysis not found");
    const raw = (stored.analysis as { integrity?: unknown } | null)?.integrity;
    const parsed = integritySchema.safeParse(raw ?? { players: [] });
    const players = parsed.success ? parsed.data.players : [];
    const bans = (await this.repository.bansFor([id])).get(id);
    return {
      players,
      bannedAfterMatch: bans?.bans ?? [],
      checkedAt: bans?.checkedAt ?? null,
    };
  }
}
