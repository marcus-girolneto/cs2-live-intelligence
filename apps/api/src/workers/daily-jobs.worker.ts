import { ViewerPolicy } from "../modules/coaching/viewer.policy.js";
import type { Logger } from "../shared/logging/logger.js";

/** Ports of the periodic account jobs. */
export interface EntitledOwners {
  entitledOwners(): Promise<{ ownerId: string; planId: string }[]>;
}
export interface PlanCreditGrants {
  syncPlanCredits(ownerId: string): Promise<unknown>;
}
export interface ScheduledReports {
  scheduled(ownerId: string): Promise<unknown>;
}
export interface AutoCoach {
  autoRegenerate(ownerId: string, viewer: ViewerPolicy): Promise<boolean>;
}
/** Global upkeep after the per-account jobs (data retention, partitions). */
export interface Upkeep {
  run(): Promise<void>;
}

/**
 * Hourly account jobs: grants the current period's plan credits to every entitled subscription
 * (idempotent per owner, plan and period start; covers admin-granted plans and monthly credits
 * of yearly subscriptions), writes the Pro monthly reports in the first days of a month and
 * regenerates Personal Coach plans once enough new analyses arrived; then the global upkeep
 * (retention of append-only tables and their monthly partitions).
 */
export class DailyJobsWorker {
  private running?: Promise<void>;
  constructor(
    private readonly owners: EntitledOwners,
    private readonly credits: PlanCreditGrants,
    private readonly reports: ScheduledReports | undefined,
    private readonly logger: Logger,
    private readonly coach?: AutoCoach,
    private readonly upkeep?: Upkeep,
  ) {}

  run(): Promise<void> {
    this.running ??= this.tick().finally(() => (this.running = undefined));
    return this.running;
  }

  private async tick(): Promise<void> {
    let granted = 0;
    let reports = 0;
    for (const { ownerId } of await this.owners.entitledOwners()) {
      try {
        if ((await this.credits.syncPlanCredits(ownerId)) === "granted")
          granted++;
        if (this.reports && (await this.reports.scheduled(ownerId))) reports++;
        if (this.coach)
          await this.coach.autoRegenerate(ownerId, ViewerPolicy.for(false));
      } catch (error) {
        this.logger.info(
          { ownerId, err: String(error) },
          "daily account job failed",
        );
      }
    }
    if (granted || reports)
      this.logger.info({ granted, reports }, "daily account jobs");
    try {
      await this.upkeep?.run();
    } catch (error) {
      this.logger.info({ err: String(error) }, "data retention failed");
    }
  }
}
