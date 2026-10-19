import type { MatchDto, MatchListDto } from "@/shared/api-types";
import { platformHttp, seg, type HttpClient } from "@/shared/http";
import type { AnalysisLike } from "../model/session";

/** A real model call can take minutes; the API enforces its own timeout. */
const AI_TIMEOUT = 10 * 60 * 1000;

export type ReviewResponse = {
  reviewId: string;
  steamId?: string;
  coaching: unknown;
  personalization?: {
    preferences?: { style?: string; tone?: string; role?: string };
    learnedFromMatches?: number;
    previousPlans?: number;
  };
};

/** Matches, analyses and AI reviews used by the /coach flow. */
export interface CoachApi {
  listMatches(): Promise<MatchDto[]>;
  getAnalysis(analysisId: string): Promise<AnalysisLike>;
  requestReview(
    analysisId: string,
    steamId: string,
    lang: string,
  ): Promise<ReviewResponse>;
  rateReview(reviewId: string, rating: number): Promise<void>;
}

export function createCoachApi(http: HttpClient = platformHttp): CoachApi {
  return {
    listMatches: () =>
      http.get<MatchListDto>("matches").then((r) => r.matches ?? []),
    getAnalysis: (analysisId) =>
      http.get<AnalysisLike>(`analyses/${seg(analysisId)}`),
    requestReview: (analysisId, steamId, lang) =>
      http.post<ReviewResponse>(
        `analyses/${seg(analysisId)}/coaching`,
        { steamId, lang },
        { timeoutMs: AI_TIMEOUT },
      ),
    rateReview: async (reviewId, rating) => {
      await http.post(`coach/reviews/${seg(reviewId)}/rating`, { rating });
    },
  };
}
export const coachApi = createCoachApi();
