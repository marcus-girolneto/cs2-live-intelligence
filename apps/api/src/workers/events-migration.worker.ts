import type { AnalysisEventsStore } from "../infrastructure/storage/events-storage.js";
import type { PipelineRepository } from "../modules/matches/pipeline.repository.js";
import type { Logger } from "../shared/logging/logger.js";
import type { ScheduledJob } from "./worker-scheduler.js";

const BATCH = 20;

/**
 * One-off background migration (re-run hourly until nothing is left): moves the `events` array
 * of existing analyses from Postgres to object storage. Per row: write the gzip file, read it
 * back and compare the count, then drop the inline array only if the row still holds exactly
 * that many events. Idempotent and safe to interrupt; rows that fail verification are retried
 * on the next run.
 */
export class EventsMigrationJob implements ScheduledJob {
  readonly intervalMs = 3600_000;
  constructor(
    private readonly pipeline: PipelineRepository,
    private readonly events: Pick<AnalysisEventsStore, "write" | "read">,
    private readonly logger: Logger,
    private readonly batch = BATCH,
  ) {}

  async run(): Promise<void> {
    let moved = 0;
    const failed = new Set<string>();
    for (;;) {
      const rows = (
        await this.pipeline.inlineEvents(this.batch + failed.size)
      ).filter((row) => !failed.has(row.id));
      if (!rows.length) break;
      for (const row of rows) {
        if (await this.move(row.id, row.events)) moved++;
        else failed.add(row.id);
      }
    }
    if (moved || failed.size)
      this.logger.info(
        {
          moved,
          failed: failed.size,
          left: await this.pipeline.inlineEventsLeft(),
        },
        "analysis events migrated to object storage",
      );
  }

  private async move(id: string, events: unknown[]): Promise<boolean> {
    try {
      const written = await this.events.write(id, events);
      const back = await this.events.read(id);
      if (written !== events.length || back?.length !== events.length)
        return false;
      return await this.pipeline.eventsMoved(id, events.length);
    } catch {
      return false;
    }
  }
}
