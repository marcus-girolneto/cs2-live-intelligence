import { platformHttp, seg, type HttpClient } from "@/shared/http";
import { normalizeJourney, type Journey } from "../model/journey";

/** The chronological progress journey and the "which player are you" identity. */
export interface ProgressApi {
  getJourney(map: string | null, signal?: AbortSignal): Promise<Journey>;
  /** Follows one player in your demos (all demos, or only the given ones). */
  setIdentity(steamId: string, analysisIds?: string[] | "all"): Promise<void>;
  rateReview(reviewId: string, rating: number): Promise<void>;
}

export function createProgressApi(
  http: HttpClient = platformHttp,
): ProgressApi {
  return {
    getJourney: async (map, signal) =>
      normalizeJourney(
        await http.get<unknown>(
          map
            ? `coach/progress?map=${encodeURIComponent(map)}`
            : "coach/progress",
          signal ? { signal } : {},
        ),
      ),
    setIdentity: async (steamId, analysisIds = "all") => {
      await http.put("coach/identity", { steamId, analysisIds });
    },
    rateReview: async (reviewId, rating) => {
      await http.post(`coach/reviews/${seg(reviewId)}/rating`, { rating });
    },
  };
}
export const progressApi = createProgressApi();
