import type { ApiConfig, JobOptions } from "../config/api-config.js";
import type { RuntimeEnv } from "../config/env.js";
import type { OfflineCoach } from "../infrastructure/ai/coaching-ai-gateway.js";
import { ProcessDemoParser } from "../infrastructure/parser/demo-parser.js";
import { FsObjectStorage } from "../infrastructure/storage/object-storage.js";
import { FileReplayStorage } from "../infrastructure/storage/replay-storage.js";
import { AnalysesController } from "../modules/analyses/analyses.controller.js";
import { AnalysesService } from "../modules/analyses/analyses.service.js";
import { AiStatusController } from "../modules/ai-config/ai-status.controller.js";
import { PgCoachPlansRepository } from "../modules/coaching/coach-plans.repository.js";
import { CoachPlansService } from "../modules/coaching/coach-plans.service.js";
import { CoachProfileService } from "../modules/coaching/coach-profile.service.js";
import { CoachingController } from "../modules/coaching/coaching.controller.js";
import { PgCoachingRepository } from "../modules/coaching/coaching.repository.js";
import { LiveCallService } from "../modules/coaching/live-call.service.js";
import { PersonalizationService } from "../modules/coaching/personalization.service.js";
import { ProgressService } from "../modules/coaching/progress.service.js";
import { ReviewService } from "../modules/coaching/review.service.js";
import { FeedbackController } from "../modules/feedback/feedback.controller.js";
import { PgFeedbackRepository } from "../modules/feedback/feedback.repository.js";
import { FeedbackService } from "../modules/feedback/feedback.service.js";
import { PgJobQueueRepository } from "../modules/matches/job-queue.repository.js";
import { MatchesController } from "../modules/matches/matches.controller.js";
import { PgMatchesRepository } from "../modules/matches/matches.repository.js";
import { MatchesService } from "../modules/matches/matches.service.js";
import type { ConsentLookup } from "../modules/privacy/privacy.repository.js";
import { PgRetentionRepository } from "../modules/matches/retention.repository.js";
import {
  FileSampleDemoSource,
  SampleDemoService,
} from "../modules/matches/sample-demo.service.js";
import { UploadService } from "../modules/matches/upload.service.js";
import { ReplayController } from "../modules/replay/replay.controller.js";
import { MatchesReplayRepository } from "../modules/replay/replay.repository.js";
import { ReplayService } from "../modules/replay/replay.service.js";
import type { Db } from "../shared/db/database.js";
import type { Logger } from "../shared/logging/logger.js";
import { DemoProcessingWorker } from "../workers/demo-processing.worker.js";
import { RetentionWorker } from "../workers/retention.worker.js";
import type { LiveContext } from "./live.js";
import type { PlatformContext } from "./platform.js";

/** Background demo processing and retention over Postgres + the filesystem. */
export function createWorkers(
  db: Db,
  options: JobOptions,
  env: RuntimeEnv,
  consent: ConsentLookup,
  coach: OfflineCoach,
  overrides: ApiConfig["overrides"] = {},
) {
  const storage = new FsObjectStorage(options.storageDir);
  const replays = new FileReplayStorage(options.storageDir);
  const parser =
    overrides.demoParser ??
    new ProcessDemoParser(
      options.parserBin,
      options.parserTimeoutMs,
      () => env.raw().PATH,
    );
  return {
    storage,
    replays,
    demos: new DemoProcessingWorker(
      overrides.jobQueue ?? new PgJobQueueRepository(db),
      consent,
      parser,
      storage,
      replays,
      coach,
    ),
    retention: new RetentionWorker(
      new PgRetentionRepository(db),
      storage,
      replays,
    ),
  };
}

/** Uploads, matches, analyses, coaching, AI status, feedback and replay (needs `jobs`). */
export function createJobsContext(
  config: ApiConfig,
  options: JobOptions,
  db: Db,
  live: LiveContext,
  platform: PlatformContext,
  env: RuntimeEnv,
  logger: Logger,
) {
  const { guards, quota, plans, privacy, aiAccess, aiGateway, aiSettings } =
    platform;
  const maxBytes = options.maxUploadBytes ?? 64 * 1024 * 1024;
  const workers = createWorkers(
    db,
    options,
    env,
    privacy,
    aiGateway,
    config.overrides,
  );
  const matches = new PgMatchesRepository(db);
  const uploads = new UploadService(
    matches,
    workers.storage,
    privacy,
    quota,
    maxBytes,
  );
  const sample = new SampleDemoService(
    new FileSampleDemoSource(() => env.sampleDemoFile()),
    aiSettings,
    matches,
    workers.storage,
    privacy,
    quota,
    maxBytes,
  );
  const coaching = new PgCoachingRepository(db);
  const coachPlans = new CoachPlansService(new PgCoachPlansRepository(db));
  const personalization = new PersonalizationService(
    coaching,
    matches,
    coachPlans,
  );
  const features = { perMapLearning: (id: string) => plans.perMapLearning(id) };
  return {
    maxBytes,
    workers,
    matchesController: new MatchesController(
      new MatchesService(matches, workers.storage, platform.audit, logger),
      uploads,
      sample,
      guards,
    ),
    analysesController: new AnalysesController(
      new AnalysesService(matches),
      guards,
    ),
    aiStatusController: new AiStatusController(aiAccess, guards),
    coachingController: new CoachingController(
      new CoachProfileService(coaching),
      new ProgressService(coaching, matches, coachPlans),
      new ReviewService(
        coaching,
        matches,
        personalization,
        quota,
        features,
        aiAccess,
        aiGateway,
        logger,
      ),
      new LiveCallService(
        coaching,
        live.store,
        personalization,
        quota,
        features,
        aiAccess,
        aiGateway,
        logger,
      ),
      guards,
    ),
    feedbackController: new FeedbackController(
      new FeedbackService(new PgFeedbackRepository(db)),
    ),
    replayController: new ReplayController(
      new ReplayService(new MatchesReplayRepository(matches), workers.replays),
    ),
  };
}
export type JobsContext = ReturnType<typeof createJobsContext>;
