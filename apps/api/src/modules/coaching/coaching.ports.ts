import type { AiConfig } from "@cs2/coaching";
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
/** plans: whether the plan feeds map-specific history into prompts. */
export interface CoachingFeatures {
  perMapLearning(ownerId: string): Promise<boolean>;
}
/** ai-config: a configured model within the daily AI cap (503/429 otherwise). */
export interface AiAccess {
  acquire(ownerId: string, purpose: "review" | "live"): Promise<AiConfig>;
}
