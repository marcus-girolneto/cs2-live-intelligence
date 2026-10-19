import { PgAiConfigRepository } from "../../src/modules/ai-config/ai-config.repository.js";
import { DevAccountSeeder } from "../../src/modules/auth/identity.js";
import { PgAuthRepository } from "../../src/modules/auth/auth.repository.js";
import { PgDevicesRepository } from "../../src/modules/devices/devices.repository.js";
import {
  PgJobQueueRepository,
  type JobOutcome,
} from "../../src/modules/matches/job-queue.repository.js";
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
    return this.jobs.analysis(ownerId, id);
  }
  requeueJobs(ids: string[]) {
    return this.jobs.requeue(ids);
  }
  claimJob() {
    return this.queue.claim();
  }
  finishJob(id: string, leaseToken: string, outcome: JobOutcome) {
    return this.queue.finish(id, leaseToken, outcome);
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
