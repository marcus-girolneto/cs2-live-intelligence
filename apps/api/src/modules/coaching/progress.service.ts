import { learnProfile } from "@cs2/coaching";
import type { DeepReview } from "@cs2/contracts";
import type { CoachPlansService } from "./coach-plans.service.js";
import type { ReviewRecord } from "./coaching.dto.js";
import type { AnalysisHistory } from "./coaching.ports.js";
import type { CoachingRepository } from "./coaching.repository.js";
import type { OwnershipRecord } from "./ownership.policy.js";
import {
  validAnalyses,
  type ParsedAnalysis,
} from "./personalization.service.js";
import { buildJourney, type JourneyMatch } from "./progress.model.js";
import type { ViewerPolicy } from "./viewer.policy.js";

type Rounds = { won?: boolean }[] | undefined;
/** Rounds won/lost by the player's team, only when every round has a known result. */
export function teamScore(rounds: Rounds): {
  roundsWon: number | null;
  roundsLost: number | null;
} {
  if (!rounds?.length || rounds.some((r) => r.won === undefined))
    return { roundsWon: null, roundsLost: null };
  const won = rounds.filter((r) => r.won).length;
  return { roundsWon: won, roundsLost: rounds.length - won };
}

/** Port (ownership): which of the owner's matches are theirs, and as which player. */
export interface OwnershipRecords {
  records(ownerId: string): Promise<OwnershipRecord[]>;
}
export type IdentityDto = {
  status: "steam" | "chosen" | "missing";
  /** Players the user reviewed or marked, most frequent first (names are display only). */
  candidates: {
    steamId: string;
    name?: string;
    matches: number;
    reviews: number;
  }[];
};

/** Who the tracked player is and which players the UI can offer when it is unknown. */
export function identityOf(
  mine: OwnershipRecord[],
  analyses: ParsedAnalysis[],
  reviews: ReviewRecord[],
): IdentityDto {
  const status = mine.some((r) => r.matchedBy === "steam")
    ? "steam"
    : mine.length
      ? "chosen"
      : "missing";
  const ids = new Set<string>([
    ...reviews.map((r) => r.steamId),
    ...mine.map((r) => r.playerSteamId).filter((s): s is string => !!s),
  ]);
  const candidates = [...ids]
    .map((steamId) => {
      const present = analyses.filter((a) =>
        a.analysis.players.some((p) => p.steamId === steamId),
      );
      const name = present
        .map((a) => a.analysis.players.find((p) => p.steamId === steamId)?.name)
        .find((n): n is string => !!n);
      return {
        steamId,
        ...(name ? { name } : {}),
        matches: present.length,
        reviews: reviews.filter((r) => r.steamId === steamId).length,
      };
    })
    .filter((c) => c.matches > 0)
    .sort((a, b) => b.matches - a.matches || b.reviews - a.reviews)
    .slice(0, 10);
  return { status, candidates };
}

/**
 * GET /v1/coach/progress?map=: the tracked player's chronological journey over the account's
 * own ("mine") matches, plan adherence, summary and the identity state; plus the learned
 * profile, per-map tabs, reviews and live calls (compatibility fields).
 */
export class ProgressService {
  constructor(
    private readonly coaching: CoachingRepository,
    /** Unfiltered history (identity candidates come from every demo). */
    private readonly history: AnalysisHistory,
    private readonly plans: CoachPlansService,
    private readonly ownership: OwnershipRecords,
  ) {}

  async progress(
    ownerId: string,
    viewer: ViewerPolicy,
    map?: string,
  ): Promise<Record<string, unknown>> {
    const [profile, analyses, records, reviewRows, calls] = await Promise.all([
      this.coaching.profile(ownerId),
      validAnalyses(this.history, ownerId),
      this.ownership.records(ownerId),
      this.coaching.reviews(ownerId, 200),
      this.coaching.liveCalls(ownerId),
    ]);
    const mine = records.filter(
      (r) => r.ownership === "mine" && r.playerSteamId,
    );
    const playerOf = new Map(mine.map((r) => [r.jobId, r.playerSteamId!]));
    const own = analyses.filter((a) => playerOf.has(a.id));
    const counts = new Map<string, number>();
    for (const id of playerOf.values())
      counts.set(id, (counts.get(id) ?? 0) + 1);
    const primary =
      [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const matches: JourneyMatch[] = own
      .filter((a) => !map || a.analysis.map === map)
      .flatMap((a) => {
        const steamId = playerOf.get(a.id)!;
        const player = a.analysis.players.find((p) => p.steamId === steamId);
        if (!player) return [];
        const mineReviews = reviewRows.filter(
          (r) => r.analysisId === a.id && r.steamId === steamId,
        );
        const latest = mineReviews[0];
        const deep = mineReviews.find((r) => r.tier === "deep")?.coaching as
          { deep?: DeepReview } | undefined;
        return [
          {
            analysisId: a.id,
            createdAt: a.createdAt,
            map: a.analysis.map ?? null,
            player,
            ...(latest
              ? {
                  review: {
                    reviewId: latest.id,
                    tier: latest.tier,
                    createdAt: latest.createdAt,
                    coaching: latest.coaching,
                  },
                }
              : {}),
            ...(deep?.deep ? { deep: deep.deep } : {}),
          },
        ];
      });
    const journey = buildJourney(matches);
    const learned = primary
      ? learnProfile(
          own.filter((a) => playerOf.get(a.id) === primary),
          primary,
        )
      : null;
    return {
      identity: identityOf(mine, analyses, reviewRows),
      playerSteamId: primary ?? profile.playerSteamId,
      linkedToSteam: profile.linkedToSteam,
      analyzedMatches: own.length,
      ...(map ? { map } : {}),
      timeline: journey.timeline,
      summary: journey.summary,
      profile: learned,
      reviews: reviewRows.map((r) => viewer.review(r)),
      liveCalls: calls.map((c) => viewer.liveCall(c)),
      ...(await this.plans.progressByMap(ownerId, primary, learned)),
    };
  }
}
