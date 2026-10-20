import type { LanguageCode } from "@cs2/contracts/languages";
import { AppError } from "../../shared/errors/index.js";
import type { Logger } from "../../shared/logging/logger.js";
import type {
  AutoReviewReason,
  AutoReviewRepository,
} from "./auto-review.repository.js";
import { ViewerPolicy } from "./viewer.policy.js";

/** Port (ownership): classify a finished job and say which player the owner is in it. */
export interface JobOwnership {
  classify(
    ownerId: string,
    jobId: string,
  ): Promise<
    { ownership: "mine" | "external"; playerSteamId: string | null } | undefined
  >;
}
/** Port (reviews): the regular player review (same credits reserve/commit path). */
export interface PlayerReviewer {
  review(
    ownerId: string,
    analysisId: string,
    steamId: string,
    lang: LanguageCode,
    viewer: ViewerPolicy,
    tier: "quick" | "deep",
  ): Promise<Record<string, unknown>>;
}
/** GET /v1/matches/auto-reviews item. */
export type AutoReviewStatusDto = {
  jobId: string;
  status: "queued" | "running" | "done" | "skipped" | "failed";
  reason?: AutoReviewReason;
  reviewId?: string;
};

/** Jobs finished in the last day are considered (older uploads are never auto-reviewed). */
export const AUTO_REVIEW_WINDOW_HOURS = 24;

const reasonOf = (error: unknown): AutoReviewReason => {
  const code = error instanceof AppError ? error.code : undefined;
  if (code === "insufficient_credits") return "insufficient_credits";
  if (code === "plan_limit" || code === "ai_limit") return "daily_cap";
  if (code === "ai_not_configured") return "ai_unavailable";
  return "error";
};

/**
 * Auto-review after upload, run in the API process (the worker has no internet): an
 * idempotent scheduler task over recently completed jobs. One auto_reviews row per job
 * (insert-once claim), skipped when the setting is off, the account is not in the demo,
 * credits are short or the daily cap is reached; otherwise the regular review runs.
 */
export class AutoReviewService {
  private running?: Promise<number>;
  constructor(
    private readonly repository: AutoReviewRepository,
    private readonly ownership: JobOwnership,
    private readonly reviews: PlayerReviewer,
    private readonly logger: Logger,
  ) {}

  /** One scheduler tick (concurrent calls share the same run). */
  tick(limit = 10): Promise<number> {
    this.running ??= this.run(limit).finally(() => (this.running = undefined));
    return this.running;
  }

  private async run(limit: number): Promise<number> {
    await this.repository.expireRunning(15);
    let handled = 0;
    for (const job of await this.repository.pending(
      limit,
      AUTO_REVIEW_WINDOW_HOURS,
    )) {
      if (!(await this.repository.claim(job.jobId, job.ownerId))) continue;
      handled++;
      await this.process(job.ownerId, job.jobId);
    }
    return handled;
  }

  private async process(ownerId: string, jobId: string): Promise<void> {
    try {
      const settings = await this.repository.settings(ownerId);
      const owned = await this.ownership.classify(ownerId, jobId);
      if (!settings.enabled)
        return this.repository.update(jobId, "skipped", "disabled");
      if (!owned || owned.ownership !== "mine" || !owned.playerSteamId)
        return this.repository.update(jobId, "skipped", "not_in_demo");
      await this.repository.update(jobId, "running");
      const result = await this.reviews.review(
        ownerId,
        jobId,
        owned.playerSteamId,
        settings.lang,
        ViewerPolicy.for(false),
        settings.tier,
      );
      await this.repository.update(
        jobId,
        "done",
        null,
        String(result.reviewId),
      );
    } catch (error) {
      const reason = reasonOf(error);
      this.logger.info(
        { jobId, reason, err: String(error) },
        "auto review not done",
      );
      await this.repository.update(
        jobId,
        reason === "error" || reason === "ai_unavailable"
          ? "failed"
          : "skipped",
        reason,
      );
    }
  }

  /** GET /v1/matches/auto-reviews?ids= */
  async statuses(
    ownerId: string,
    ids: string[],
  ): Promise<{ items: AutoReviewStatusDto[] }> {
    const rows = await this.repository.forJobs(ownerId, ids);
    return {
      items: rows.map((r) => ({
        jobId: r.jobId,
        status: r.status,
        ...(r.reason ? { reason: r.reason } : {}),
        ...(r.reviewId ? { reviewId: r.reviewId } : {}),
      })),
    };
  }
}
