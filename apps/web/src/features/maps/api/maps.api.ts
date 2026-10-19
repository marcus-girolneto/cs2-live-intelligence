import { platformHttp, seg, type HttpClient } from "@/shared/http";
import type { Progress } from "../model/progress";

/** Coach progress (per-map learning, plans, reviews, live calls). */
export interface MapsApi {
  getProgress(signal?: AbortSignal): Promise<Progress>;
  rateReview(reviewId: string, rating: number): Promise<void>;
}

export function createMapsApi(http: HttpClient = platformHttp): MapsApi {
  return {
    getProgress: (signal) =>
      http.get<Progress>("coach/progress", signal ? { signal } : {}),
    rateReview: async (reviewId, rating) => {
      await http.post(`coach/reviews/${seg(reviewId)}/rating`, { rating });
    },
  };
}
export const mapsApi = createMapsApi();
