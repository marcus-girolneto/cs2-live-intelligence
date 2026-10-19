import type { AiConfig, DeepReplay } from "@cs2/coaching";
import type { AiPurpose } from "../ai-config/ai-config.dto.js";
import type { CreditHold } from "../credits/credits.service.js";
import type {
  CompletedAnalysis,
  StoredAnalysis,
} from "../matches/matches.dto.js";
import type { StoredSession } from "../telemetry/telemetry.repository.js";
import type { Reservation } from "../usage/usage.service.js";

/** Ports the coaching services depend on; each is implemented by another module. */

/** matches: the owner's analyses. */
export interface AnalysisHistory {
  analysis(ownerId: string, id: string): Promise<StoredAnalysis | undefined>;
  completedAnalyses(
    ownerId: string,
    limit?: number,
  ): Promise<CompletedAnalysis[]>;
}
/** telemetry: the server's authoritative live-session state. */
export interface LiveSessionReader {
  session(id: string): Promise<StoredSession | undefined>;
}
/** usage: plan quotas for AI features (402 when exhausted). */
export interface CoachingQuota {
  reserveReview(ownerId: string): Promise<Reservation>;
  reserveLiveCall(ownerId: string, matchKey: string): Promise<Reservation>;
}
/** plans: feature switches of the account's plan. */
export interface CoachingFeatures {
  perMapLearning(ownerId: string): Promise<boolean>;
  /** Pro: deep reviews compare with previous deep reviews on the same map. */
  deepHistory(ownerId: string): Promise<boolean>;
  /** Pro: full-match highlight/mistake reel. */
  reel(ownerId: string): Promise<boolean>;
}
/** ai-config: a configured model within the daily AI cap (503/429 otherwise). */
export interface AiAccess {
  acquire(ownerId: string, purpose: AiPurpose): Promise<AiConfig>;
}
/** credits: reserve the review's cost before the model call (402 insufficient_credits). */
export interface CoachingCredits {
  reserve(
    ownerId: string,
    tier: "quick" | "deep" | "team",
  ): Promise<CreditHold>;
  balance(ownerId: string): Promise<number>;
}
/** replay: the replay samples of an analysis (deep reviews; undefined when none). */
export interface DeepReplaySource {
  read(analysisId: string): Promise<DeepReplay | undefined>;
}
