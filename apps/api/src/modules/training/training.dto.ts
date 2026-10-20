import { z } from "zod";
import type {
  CatalogEntryDto,
  PracticeDay,
  TrainingPlan,
} from "@cs2/contracts";

export const trainingQuerySchema = z.object({
  steamId: z.string().regex(/^[0-9A-Za-z_-]{1,64}$/),
});

/** GET /v1/training/catalog. */
export type TrainingCatalogDto = {
  verifiedAt: string;
  skills: CatalogEntryDto["skill"][];
  entries: CatalogEntryDto[];
};
/** GET /v1/analyses/:id/training?steamId=. */
export type AnalysisTrainingDto = {
  analysisId: string;
  steamId: string;
  training: TrainingPlan;
};
/** GET /v1/training/recommended (from the tracked player's latest own matches). */
export type RecommendedTrainingDto = {
  steamId: string | null;
  latest: {
    analysisId: string;
    createdAt: string;
    map: string | null;
    training: TrainingPlan;
  } | null;
  /** Weakest skills over the latest matches (most frequent first). */
  focus: TrainingPlan["focus"];
  week: PracticeDay[];
  matches: number;
};
