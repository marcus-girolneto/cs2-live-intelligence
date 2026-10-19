import { normalizedDemoSchema } from "@cs2/contracts";
import { analyzeDemo } from "@cs2/analytics";
import type { OfflineCoach } from "../infrastructure/ai/coaching-ai-gateway.js";
import type { DemoParser } from "../infrastructure/parser/demo-parser.js";
import type { ReplayStorage } from "../infrastructure/storage/replay-storage.js";
import type { JobQueueRepository } from "../modules/matches/job-queue.repository.js";
import type { ConsentLookup } from "../modules/privacy/privacy.repository.js";

export interface WorkerCounters {
  complete: number;
  failed: number;
  errors: number;
}

/** Where a stored demo object lives on disk (the parser reads files, not streams). */
export interface DemoLocator {
  path(objectKey: string): string;
}

/**
 * Processes one queued demo at a time: parse (with replay artifact) → consent re-check →
 * analytics → offline coaching → fenced completion. Failures store a safe message only.
 */
export class DemoProcessingWorker {
  readonly counters: WorkerCounters = { complete: 0, failed: 0, errors: 0 };
  private running = false;
  private stopped = false;
  private current: Promise<void> | undefined;

  constructor(
    private readonly queue: JobQueueRepository,
    private readonly consent: ConsentLookup,
    private readonly parser: DemoParser,
    private readonly demos: DemoLocator,
    private readonly replays: ReplayStorage,
    private readonly coach: OfflineCoach,
  ) {}

  /** Runs one job unless a run is in progress (then returns that run). */
  runOnce(): Promise<void> {
    if (this.running || this.stopped) return this.current ?? Promise.resolve();
    this.current = this.execute();
    return this.current;
  }

  /** Stops accepting runs and waits for the current one. */
  async stop(): Promise<void> {
    this.stopped = true;
    await this.current;
  }

  private async execute(): Promise<void> {
    this.running = true;
    try {
      const job = await this.queue.claim();
      if (!job) return;
      try {
        const input = normalizedDemoSchema.parse(
          await this.parser.parse(
            this.demos.path(job.objectKey),
            this.replays.pathFor(job.id),
          ),
        );
        if (!(await this.consent.settings(job.ownerId)).telemetryConsent)
          throw new Error("Consent withdrawn");
        const analysis = analyzeDemo(input);
        const coaching = await this.coach.coach(analysis);
        await this.queue.finish(job.id, job.leaseToken, { analysis, coaching });
        this.counters.complete++;
      } catch (error) {
        await this.replays.remove(job.id).catch(() => undefined);
        await this.queue.finish(job.id, job.leaseToken, {
          error: safeMessage(error),
        });
        this.counters.failed++;
      }
    } catch {
      this.counters.errors++;
    } finally {
      this.running = false;
    }
  }
}

/** Parser/key errors are already safe; anything else becomes a generic message. */
function safeMessage(error: unknown): string {
  return error instanceof Error &&
    /^(Demo parser|Invalid object key)/.test(error.message)
    ? error.message
    : "Demo analysis failed contract validation or coaching generation";
}
