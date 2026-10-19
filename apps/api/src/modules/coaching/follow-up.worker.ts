import type { Logger } from "../../shared/logging/logger.js";

export interface FollowUpTasks {
  backfill(limit?: number): Promise<number>;
}
export interface AutoReviewTick {
  tick(limit?: number): Promise<number>;
}

/** How often the API checks newly processed demos (ownership + auto-review). */
export const FOLLOW_UP_INTERVAL_MS = 15_000;

/**
 * API-side follow-up of processed demos: classifies match ownership (also the startup
 * backfill of older jobs) and runs auto-reviews. Runs in the API process because the demo
 * worker has no internet access.
 */
export class CoachFollowUpWorker {
  private timer?: ReturnType<typeof setInterval>;
  private busy?: Promise<void>;
  constructor(
    private readonly ownership: FollowUpTasks,
    private readonly autoReviews: AutoReviewTick,
    private readonly logger: Logger,
  ) {}

  runOnce(): Promise<void> {
    this.busy ??= (async () => {
      try {
        await this.ownership.backfill(200);
        await this.autoReviews.tick(10);
      } catch (error) {
        this.logger.info({ err: String(error) }, "coach follow-up failed");
      }
    })().finally(() => (this.busy = undefined));
    return this.busy;
  }

  start(intervalMs = FOLLOW_UP_INTERVAL_MS): void {
    void this.runOnce();
    this.timer = setInterval(() => void this.runOnce(), intervalMs);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.busy;
  }
}
