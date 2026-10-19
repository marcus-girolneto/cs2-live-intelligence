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

/**
 * Hourly account jobs: grants the current period's plan credits to every entitled subscription
 * (idempotent per owner, plan and period start; covers admin-granted plans and monthly credits
 * of yearly subscriptions) and writes the Pro monthly reports in the first days of a month.
 */
export class DailyJobsWorker {
  private running?: Promise<void>;
  constructor(
    private readonly owners: EntitledOwners,
    private readonly credits: PlanCreditGrants,
    private readonly reports: ScheduledReports | undefined,
    private readonly logger: Logger,
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
      } catch (error) {
        this.logger.info(
          { ownerId, err: String(error) },
          "daily account job failed",
        );
      }
    }
    if (granted || reports)
      this.logger.info({ granted, reports }, "daily account jobs");
  }
}
