import type { DeepReplay, TrainingReview } from "@cs2/coaching";

/** Ports the training module depends on (implemented by matches, replay and coaching). */

/** matches: one of the owner's analyses (undefined when not the owner's). */
export interface TrainingAnalyses {
  analysis(
    ownerId: string,
    id: string,
  ): Promise<{ id: string; analysis: unknown } | undefined>;
}
/** replay: the replay samples of an analysis (undefined when none are stored). */
export interface TrainingReplays {
  read(analysisId: string): Promise<DeepReplay | undefined>;
}
/** coaching: the newest stored review of the player in the match, and the tracked player. */
export interface TrainingReviews {
  latest(
    ownerId: string,
    analysisId: string,
    steamId: string,
  ): Promise<TrainingReview | undefined>;
  playerSteamId(ownerId: string): Promise<string | null>;
}
/** matches (own matches only): the newest completed analyses, newest first. */
export interface TrainingRecent {
  recent(
    ownerId: string,
    limit: number,
  ): Promise<{ id: string; createdAt: string; analysis: unknown }[]>;
}
