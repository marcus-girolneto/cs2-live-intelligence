import type { LearnedProfile, PreviousPlan } from "@cs2/coaching";
import type {
  CoachPlansRepository,
  ReviewPlanRecord,
} from "./coach-plans.repository.js";
import type { MapProgressDto, ProgressByMapDto } from "./progress.dto.js";

/** Map-aware coaching history: previous plans for prompts and per-map progress tabs. */
export class CoachPlansService {
  constructor(private readonly plans: CoachPlansRepository) {}

  previousPlans(
    ownerId: string,
    steamId: string,
    excludeAnalysisId: string | null,
  ): Promise<PreviousPlan[]> {
    return this.plans.previousPlans(ownerId, steamId, excludeAnalysisId ?? "");
  }

  async progressByMap(
    ownerId: string,
    steamId: string | null,
    profile: LearnedProfile | null,
  ): Promise<ProgressByMapDto> {
    if (!steamId) return { maps: [], generalPlan: [], generalPlanFrom: null };
    return groupProgress(
      profile,
      await this.plans.reviewPlans(ownerId, steamId),
    );
  }
}

/** Pure grouping (unit-tested): one tab per learned map, newest first, plus the general plan. */
export function groupProgress(
  profile: LearnedProfile | null,
  reviews: ReviewPlanRecord[],
): ProgressByMapDto {
  const newest = [...reviews].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const maps: MapProgressDto[] = Object.entries(profile?.perMap ?? {})
    .map(([map, p]) => {
      const latest = newest.find(
        (r) => r.map === map && r.items.some((i) => i.scope === "map"),
      );
      return {
        map,
        matches: p.matches,
        rounds: p.rounds,
        lastPlayedAt: p.lastPlayedAt,
        metrics: p.metrics,
        recurring: p.recurring,
        places: p.places,
        openPlanItems: latest
          ? latest.items
              .filter((i) => i.scope === "map")
              .map((i) => ({ ...i, map }))
          : [],
        openPlanFrom: latest
          ? { reviewId: latest.reviewId, date: latest.createdAt }
          : null,
      };
    })
    .sort((a, b) => b.lastPlayedAt.localeCompare(a.lastPlayedAt));
  const general = newest.find((r) =>
    r.items.some((i) => i.scope === "general"),
  );
  return {
    maps,
    generalPlan: general
      ? general.items.filter((i) => i.scope === "general")
      : [],
    generalPlanFrom: general
      ? { reviewId: general.reviewId, date: general.createdAt }
      : null,
  };
}
