import { PgAiConfigRepository } from "../../src/modules/ai-config/ai-config.repository.js";
import { DevAccountSeeder } from "../../src/modules/auth/identity.js";
import { PgAuthRepository } from "../../src/modules/auth/auth.repository.js";
import { PgDevicesRepository } from "../../src/modules/devices/devices.repository.js";
import { PgCreditsRepository } from "../../src/modules/credits/credits.repository.js";
import { randomUUID } from "node:crypto";
import {
  PgJobQueueRepository,
  type JobOutcome,
} from "../../src/modules/matches/job-queue.repository.js";
import { matchRecord } from "../../src/modules/matches/match-record.js";
import { HydratingMatchesRepository } from "../../src/modules/analyses/analysis-reader.js";
import {
  analysisKey,
  FileAnalysisStore,
} from "../../src/infrastructure/storage/analysis-storage.js";
import { FileAnalysisEventsStore } from "../../src/infrastructure/storage/events-storage.js";
import type { NewDemoJob } from "../../src/modules/matches/matches.dto.js";
import { PgMatchesRepository } from "../../src/modules/matches/matches.repository.js";
import { PgRetentionRepository } from "../../src/modules/matches/retention.repository.js";
import { PgPlansRepository } from "../../src/modules/plans/plans.repository.js";
import { PlansService } from "../../src/modules/plans/plans.service.js";
import type { SettingsDto } from "../../src/modules/privacy/privacy.dto.js";
import { PgPrivacyRepository } from "../../src/modules/privacy/privacy.repository.js";
import { PgLiveSessionStore } from "../../src/modules/telemetry/telemetry.repository.js";
import { ZonedClock } from "../../src/shared/clock/clock.js";
import { Database } from "../../src/shared/db/database.js";

/**
 * Test fixture: the app's Database plus the module repositories the integration tests use to
 * arrange data and assert on it directly (a test-only facade over the real Pg adapters).
 */
export class TestDatabase extends Database {
  private readonly auth = new PgAuthRepository(this.db);
  private readonly devices = new PgDevicesRepository(this.db);
  private readonly privacy = new PgPrivacyRepository(this.db);
  private readonly sessions = new PgLiveSessionStore(this.db);
  private readonly jobs = new PgMatchesRepository(this.db);
  private readonly queue = new PgJobQueueRepository(this.db);
  private readonly retention = new PgRetentionRepository(this.db);
  private readonly ai = new PgAiConfigRepository(this.db);
  readonly credits = new PgCreditsRepository(this.db);
  /**
   * Object storage directory of the app under test: `finishJob` with a raw analysis writes the
   * match document and events there, and `analysis` reads them back.
   */
  storageDir?: string;

  private storage(): {
    analyses: FileAnalysisStore;
    events: FileAnalysisEventsStore;
  } {
    if (!this.storageDir)
      throw new Error(
        "TestDatabase.storageDir is required for match documents",
      );
    return {
      analyses: new FileAnalysisStore(this.storageDir),
      events: new FileAnalysisEventsStore(this.storageDir),
    };
  }

  /** Bonus credits for a test account (ledger admin_adjust, like the admin endpoint). */
  async grantCredits(ownerId: string, delta: number) {
    return this.credits.credit(
      { ownerId, delta, reason: "admin_adjust", bucket: "bonus", note: "test" },
      new Date(),
    );
  }

  seedDev(
    ownerId: string,
    webToken: string,
    deviceId: string,
    deviceToken: string,
  ) {
    return new DevAccountSeeder(this.db).seed({
      ownerId,
      webToken,
      deviceId,
      deviceToken,
    });
  }
  owner(token: string) {
    return this.auth.ownerForToken(token);
  }
  device(token: string) {
    return this.devices.deviceForToken(token);
  }
  settings(ownerId: string) {
    return this.privacy.settings(ownerId);
  }
  async updateSettings(ownerId: string, settings: SettingsDto) {
    await this.privacy.update(ownerId, settings);
    return settings;
  }
  session(id: string) {
    return this.sessions.session(id);
  }
  createJob(ownerId: string, file: NewDemoJob) {
    return this.jobs.createJob(ownerId, file);
  }
  async matches(ownerId: string) {
    return { matches: await this.jobs.list(ownerId) };
  }
  match(ownerId: string, id: string) {
    return this.jobs.find(ownerId, id);
  }
  analysis(ownerId: string, id: string) {
    const { analyses, events } = this.storage();
    return new HydratingMatchesRepository(this.jobs, analyses, events).analysis(
      ownerId,
      id,
    );
  }
  requeueJobs(ids: string[]) {
    return this.jobs.requeue(ids);
  }
  claimJob() {
    return this.queue.claim();
  }
  /**
   * Completes a leased job like the worker does: a raw `{analysis, coaching}` becomes the match
   * of the upload's checksum (overwriting an existing match of the same bytes and parser
   * version), with its document and events written to `storageDir`.
   */
  async finishJob(
    id: string,
    leaseToken: string,
    outcome:
      | JobOutcome
      | { analysis: unknown; coaching: unknown; eventsCount?: number },
  ) {
    if (!("analysis" in outcome))
      return this.queue.finish(id, leaseToken, outcome);
    const { analyses, events } = this.storage();
    const upload = await this.pool.query(
      "select checksum from uploads where id=$1",
      [id],
    );
    const checksum = (upload.rows[0]?.checksum as string | undefined) ?? "";
    const { events: list, ...doc } = outcome.analysis as Record<
      string,
      unknown
    >;
    const version =
      (doc.provenance as { parserVersion?: string } | undefined)
        ?.parserVersion ?? null;
    const existing = version
      ? await this.queue.matchFor(checksum, version)
      : undefined;
    const matchId = existing ?? randomUUID();
    const eventsCount = Array.isArray(list)
      ? await events.write(matchId, list)
      : null;
    await analyses.write(matchId, doc);
    return this.queue.finish(id, leaseToken, {
      match: matchRecord({
        id: matchId,
        checksum,
        analysis: doc,
        coaching: outcome.coaching,
        analysisKey: analysisKey(matchId),
        eventsCount,
      }),
    });
  }
  pendingDeletions() {
    return this.retention.pendingDeletions();
  }
  reserveProvider(ownerId: string, limit: number) {
    return this.ai.reserveDailyRequest(ownerId, limit);
  }
}

/** Limits and features that apply to an account (admins: unlimited, every feature). */
export function effectivePlan(database: Database, ownerId: string) {
  return new PlansService(
    new PgPlansRepository(database.db),
    new ZonedClock(),
  ).effective(ownerId);
}
