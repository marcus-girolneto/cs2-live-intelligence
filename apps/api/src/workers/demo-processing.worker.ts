import { randomUUID } from "node:crypto";
import { normalizedDemoSchema } from "@cs2/contracts";
import { analyzeDemo } from "@cs2/analytics";
import type { OfflineCoach } from "../infrastructure/ai/coaching-ai-gateway.js";
import type { DemoParser } from "../infrastructure/parser/demo-parser.js";
import type { ReplayStorage } from "../infrastructure/storage/replay-storage.js";
import {
  analysisKey,
  type AnalysisStore,
} from "../infrastructure/storage/analysis-storage.js";
import type { AnalysisEventsStore } from "../infrastructure/storage/events-storage.js";
import type {
  ClaimedJob,
  JobQueueRepository,
} from "../modules/matches/job-queue.repository.js";
import { matchRecord } from "../modules/matches/match-record.js";
import type { ConsentLookup } from "../modules/privacy/privacy.repository.js";
import type { AnalysisDedupe } from "../modules/matches/analysis-dedupe.js";

/** Match artifact stores and the optional dedupe stage. */
export interface ProcessingPipeline {
  /** The full analysis document of a match (`<matchId>.analysis.json.gz`). */
  analyses: Pick<AnalysisStore, "write" | "remove">;
  /** The analysis `events` (`<matchId>.events.json.gz`). */
  events: Pick<AnalysisEventsStore, "write" | "remove">;
  /** Completes uploads whose demo was already parsed by the current parser. */
  dedupe?: Pick<AnalysisDedupe, "tryComplete">;
  /** The current parser version (the match to overwrite on a forced re-run). */
  parserVersion?: () => Promise<string | undefined>;
}

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
 * Processes one queued upload at a time: dedupe (point at the existing match, no parse) or
 * parse (replay artifact) → consent re-check → analytics → offline coaching → the match's
 * analysis and events to object storage → fenced completion (match row, players, upload link).
 * Failures store a safe message only. Background re-parses after a parser upgrade take the
 * same path; their failure keeps the previous match.
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
    private readonly pipeline: ProcessingPipeline,
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

  /** The match the parse writes to: the existing one of these bytes, else a new id. */
  private async target(
    job: ClaimedJob,
  ): Promise<{ id: string; isNew: boolean }> {
    const version = await this.pipeline.parserVersion?.();
    const existing =
      version && job.checksum
        ? await this.queue.matchFor(job.checksum, version)
        : undefined;
    return existing
      ? { id: existing, isNew: false }
      : { id: randomUUID(), isNew: true };
  }

  private async removeArtifacts(matchId: string): Promise<void> {
    await this.replays.remove(matchId).catch(() => undefined);
    await this.pipeline.events.remove(matchId).catch(() => undefined);
    await this.pipeline.analyses.remove(matchId).catch(() => undefined);
  }

  private async process(job: ClaimedJob): Promise<void> {
    if (!job.force && (await this.pipeline.dedupe?.tryComplete(job))) return;
    const target = await this.target(job);
    try {
      const input = normalizedDemoSchema.parse(
        await this.parser.parse(
          this.demos.path(job.objectKey),
          this.replays.pathFor(target.id),
        ),
      );
      if (!(await this.consent.settings(job.ownerId)).telemetryConsent)
        throw new Error("Consent withdrawn");
      const { events, ...analysis } = analyzeDemo(input);
      const coaching = await this.coach.coach({ ...analysis, events });
      const eventsCount = await this.pipeline.events.write(
        target.id,
        events ?? [],
      );
      await this.pipeline.analyses.write(target.id, analysis);
      const result = await this.queue.finish(job.id, job.leaseToken, {
        match: matchRecord({
          id: target.id,
          checksum: job.checksum ?? "",
          analysis,
          coaching,
          ...(input.tickRate ? { tickRate: input.tickRate } : {}),
          analysisKey: analysisKey(target.id),
          eventsCount,
        }),
      });
      if (result && "discarded" in result && result.discarded)
        await this.removeArtifacts(result.discarded);
    } catch (error) {
      // Files of an existing (shared) match are never removed on failure.
      if (target.isNew) await this.removeArtifacts(target.id);
      throw error;
    }
  }

  private async execute(): Promise<void> {
    this.running = true;
    try {
      const job = await this.queue.claim();
      if (!job) return;
      try {
        await this.process(job);
        this.counters.complete++;
      } catch (error) {
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
