import type { DataRetention } from "../modules/ai-config/ai-config.dto.js";
import {
  PARTITIONED_TABLES,
  type MaintenanceRepository,
  type PurgeTarget,
} from "../modules/maintenance/maintenance.repository.js";
import type { Logger } from "../shared/logging/logger.js";

const DAY_MS = 24 * 3600_000;
/** Partitions created ahead of time (this month + 2), so inserts never miss one. */
const MONTHS_AHEAD = 2;
const BATCH = 5000;
/** Upper bound of batches per table and run (the next hourly run continues). */
const MAX_BATCHES = 40;

/** Port: the admin-editable retention (app settings, defaults applied). */
export interface RetentionSettings {
  retention(): Promise<DataRetention>;
}

/**
 * Global retention of append-only tables, run with the hourly account jobs: creates the next
 * monthly partitions of telemetry_events and product_events, drops partitions entirely past
 * their retention, and deletes remaining old rows in batches (telemetry 30 days, product events
 * 180, admin audit 365, usage counters 90, processed file deletions 7; admin-editable under
 * app settings `retention`). Account retention (users.retention_days) runs in the demo worker.
 */
export class DataRetentionJob {
  constructor(
    private readonly repository: MaintenanceRepository,
    private readonly settings: RetentionSettings,
    private readonly logger: Logger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async run(): Promise<void> {
    const days = await this.settings.retention();
    const now = this.now().getTime();
    const before = (d: number): Date => new Date(now - d * DAY_MS);
    const created: Record<string, number> = {};
    const dropped: string[] = [];
    for (const table of PARTITIONED_TABLES) {
      created[table] = await this.repository.ensurePartitions(
        table,
        MONTHS_AHEAD,
      );
      const keep =
        table === "telemetry_events"
          ? days.telemetryEventsDays
          : days.productEventsDays;
      dropped.push(
        ...(await this.repository.dropPartitionsBefore(table, before(keep))),
      );
    }
    const targets: [PurgeTarget, number][] = [
      ["telemetry_events", days.telemetryEventsDays],
      ["product_events", days.productEventsDays],
      ["admin_audit", days.adminAuditDays],
      ["usage_counters", days.usageDays],
      ["usage_live_matches", days.usageDays],
      ["provider_usage", days.usageDays],
      ["file_deletions", days.fileDeletionsDays],
    ];
    const deleted: Record<string, number> = {};
    for (const [table, keep] of targets) {
      let total = 0;
      for (let i = 0; i < MAX_BATCHES; i++) {
        const n = await this.repository.purgeBatch(table, before(keep), BATCH);
        total += n;
        if (n < BATCH) break;
      }
      if (total) deleted[table] = total;
    }
    const partitions = Object.values(created).reduce((a, b) => a + b, 0);
    if (partitions || dropped.length || Object.keys(deleted).length)
      this.logger.info(
        { partitionsCreated: partitions, partitionsDropped: dropped, deleted },
        "data retention",
      );
  }
}
