import { platformHttp, seg, type HttpClient } from "@/shared/http";
import type { AnalysisResult } from "../model/types";

/** Stored analyses and the "this is me" coach profile link. */
export interface AnalysisApi {
  getAnalysis(
    analysisId: string,
    signal?: AbortSignal,
  ): Promise<AnalysisResult>;
  /** Links (or unlinks with null) the coached player for accounts without Steam. */
  setCoachPlayer(steamId: string | null): Promise<void>;
}

export function createAnalysisApi(
  http: HttpClient = platformHttp,
): AnalysisApi {
  return {
    getAnalysis: (analysisId, signal) =>
      http.get<AnalysisResult>(
        `analyses/${seg(analysisId)}`,
        signal ? { signal } : {},
      ),
    setCoachPlayer: async (steamId) => {
      await http.put("coach/profile", { playerSteamId: steamId });
    },
  };
}
export const analysisApi = createAnalysisApi();
