import { platformHttp, seg, type HttpClient } from "@/shared/http";
import {
  normalizeCatalog,
  normalizePlan,
  normalizeRecommended,
} from "../model/normalize";
import type { Catalog, Plan, Recommended } from "../model/types";

/** Practice catalog, per-match training plans and "recommended for you" (no AI). */
export interface TrainingApi {
  catalog(): Promise<Catalog>;
  /** null when the match has no plan (unknown shape). */
  forAnalysis(analysisId: string, steamId: string): Promise<Plan | null>;
  recommended(): Promise<Recommended>;
}

export function createTrainingApi(
  http: HttpClient = platformHttp,
): TrainingApi {
  return {
    catalog: async () =>
      normalizeCatalog(await http.get<unknown>("training/catalog")),
    forAnalysis: async (analysisId, steamId) => {
      const body = await http.get<{ training?: unknown }>(
        `analyses/${seg(analysisId)}/training`,
        { query: { steamId } },
      );
      return normalizePlan(body?.training);
    },
    recommended: async () =>
      normalizeRecommended(await http.get<unknown>("training/recommended")),
  };
}

export const trainingApi = createTrainingApi();
