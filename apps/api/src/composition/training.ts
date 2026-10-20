import type { DeepReplay, TrainingReview } from "@cs2/coaching";
import { TrainingController } from "../modules/training/training.controller.js";
import { TrainingService } from "../modules/training/training.service.js";

/** What the training module needs from the jobs context (structural, wired in jobs.ts). */
export type TrainingSources = {
  matches: {
    analysis(
      ownerId: string,
      id: string,
    ): Promise<{ id: string; analysis: unknown } | undefined>;
  };
  replays: { read(analysisId: string): Promise<DeepReplay | undefined> };
  coaching: {
    matchReviews(
      ownerId: string,
      analysisId: string,
      steamId: string,
    ): Promise<{ coaching: unknown }[]>;
    profile(ownerId: string): Promise<{ playerSteamId: string | null }>;
  };
  mine: {
    completedAnalyses(
      ownerId: string,
      limit?: number,
    ): Promise<{ id: string; createdAt: string; analysis: unknown }[]>;
  };
};

/** Training: catalog, per-match plans (+ the `training` field of review responses). */
export function createTrainingContext(sources: TrainingSources) {
  const service = new TrainingService({
    analyses: sources.matches,
    replays: sources.replays,
    reviews: {
      latest: async (ownerId, analysisId, steamId) =>
        (await sources.coaching.matchReviews(ownerId, analysisId, steamId))[0]
          ?.coaching as TrainingReview | undefined,
      playerSteamId: async (ownerId) =>
        (await sources.coaching.profile(ownerId)).playerSteamId,
    },
    recent: {
      recent: (ownerId, limit) =>
        sources.mine.completedAnalyses(ownerId, limit),
    },
  });
  return { service, controller: new TrainingController(service) };
}
export type TrainingContext = ReturnType<typeof createTrainingContext>;
