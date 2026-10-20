import { platformHttp, seg, type HttpClient } from "@/shared/http";
import {
  normalizeIntegrity,
  normalizeLobby,
  type Integrity,
  type LobbyMetric,
} from "../model/extras";
import type { AnalysisResult } from "../model/types";

/** Stored analyses and the "this is me" coach profile link. */
export interface AnalysisApi {
  getAnalysis(
    analysisId: string,
    signal?: AbortSignal,
  ): Promise<AnalysisResult>;
  /** Links (or unlinks with null) the coached player for accounts without Steam. */
  setCoachPlayer(steamId: string | null): Promise<void>;
  /** "You vs the lobby": the player's rank on each metric. */
  getLobby(analysisId: string, steamId: string): Promise<LobbyMetric[]>;
  /** Statistical integrity signals of the match (owner only). */
  getIntegrity(analysisId: string): Promise<Integrity>;
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
    getLobby: async (analysisId, steamId) =>
      normalizeLobby(
        await http.get<unknown>(`analyses/${seg(analysisId)}/lobby`, {
          query: { steamId },
        }),
      ),
    getIntegrity: async (analysisId) =>
      normalizeIntegrity(
        await http.get<unknown>(`analyses/${seg(analysisId)}/integrity`),
      ),
    setCoachPlayer: async (steamId) => {
      await http.put("coach/profile", { playerSteamId: steamId });
    },
  };
}
export const analysisApi = createAnalysisApi();
