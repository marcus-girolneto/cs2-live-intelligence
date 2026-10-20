import type { ApiConfig, JobOptions } from "../config/api-config.js";
import type { RuntimeEnv } from "../config/env.js";
import { AnalysesController } from "../modules/analyses/analyses.controller.js";
import { AnalysesService } from "../modules/analyses/analyses.service.js";
import {
  HydratingMatchesRepository,
  UploadReplays,
} from "../modules/analyses/analysis-reader.js";
import { SteamPlayerBans } from "../infrastructure/steam/player-bans.js";
import { BanCheckJob } from "../modules/integrity/ban-check.job.js";
import { PgIntegrityRepository } from "../modules/integrity/integrity.repository.js";
import { IntegrityService } from "../modules/integrity/integrity.service.js";
import { AiStatusController } from "../modules/ai-config/ai-status.controller.js";
import { PgCoachPlansRepository } from "../modules/coaching/coach-plans.repository.js";
import { CoachPlansService } from "../modules/coaching/coach-plans.service.js";
import { CoachProfileService } from "../modules/coaching/coach-profile.service.js";
import { CoachingController } from "../modules/coaching/coaching.controller.js";
import { PgCoachingRepository } from "../modules/coaching/coaching.repository.js";
import { LiveCallService } from "../modules/coaching/live-call.service.js";
import { PersonalizationService } from "../modules/coaching/personalization.service.js";
import { ProgressService } from "../modules/coaching/progress.service.js";
import { ReelService } from "../modules/coaching/reel.service.js";
import { ReviewService } from "../modules/coaching/review.service.js";
import { SettingsReviewAi } from "../modules/coaching/review-ai.policy.js";
import { CoachExtrasController } from "../modules/coaching/coach-extras.controller.js";
import { MineOnlyHistory } from "../modules/coaching/mine-history.js";
import { PgOwnershipRepository } from "../modules/coaching/ownership.repository.js";
import { OwnershipService } from "../modules/coaching/ownership.service.js";
import { PgTeamReviewRepository } from "../modules/coaching/team-review.repository.js";
import { TeamReviewService } from "../modules/coaching/team-review.service.js";
import { PgAutoReviewRepository } from "../modules/coaching/auto-review.repository.js";
import { AutoReviewService } from "../modules/coaching/auto-review.service.js";
import { CoachFollowUpWorker } from "../modules/coaching/follow-up.worker.js";
import { AiQualityController } from "../modules/ai-config/ai-quality.controller.js";
import { PgAiQualityRepository } from "../modules/ai-config/ai-quality.repository.js";
import { AiQualityService } from "../modules/ai-config/ai-quality.service.js";
import {
  CoachingAiGateway,
  type TeamAiGateway,
} from "../infrastructure/ai/coaching-ai-gateway.js";
import { ReportsController } from "../modules/reports/reports.controller.js";
import { PgReportsRepository } from "../modules/reports/reports.repository.js";
import { ReportsService } from "../modules/reports/reports.service.js";
import { DailyJobsWorker } from "../workers/daily-jobs.worker.js";
import { PersonalCoachController } from "../modules/personal-coach/personal-coach.controller.js";
import { PgPersonalCoachRepository } from "../modules/personal-coach/personal-coach.repository.js";
import { PersonalCoachService } from "../modules/personal-coach/personal-coach.service.js";
import { FeedbackController } from "../modules/feedback/feedback.controller.js";
import { PgFeedbackRepository } from "../modules/feedback/feedback.repository.js";
import { FeedbackService } from "../modules/feedback/feedback.service.js";
import { MatchesController } from "../modules/matches/matches.controller.js";
import { PgMatchesRepository } from "../modules/matches/matches.repository.js";
import { MatchesService } from "../modules/matches/matches.service.js";
import {
  FileSampleDemoSource,
  SampleDemoService,
} from "../modules/matches/sample-demo.service.js";
import { UploadService } from "../modules/matches/upload.service.js";
import { UploadRateLimiter } from "../modules/matches/upload-rate-limit.js";
import { ReplayController } from "../modules/replay/replay.controller.js";
import { MatchesReplayRepository } from "../modules/replay/replay.repository.js";
import { ReplayService } from "../modules/replay/replay.service.js";
import type { Db } from "../shared/db/database.js";
import type { Logger } from "../shared/logging/logger.js";
import { createWorkers } from "./demo-pipeline.js";
import type { LiveContext } from "./live.js";
import type { PlatformContext } from "./platform.js";

export { createWorkers } from "./demo-pipeline.js";

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
  const {
    guards,
    quota,
    plans,
    privacy,
    aiAccess,
    aiGateway,
    aiSettings,
    credits,
    clock,
  } = platform;
  const maxBytes = platform.uploadLimits.ceiling;
  const workers = createWorkers(
    db,
    options,
    env,
    privacy,
    aiGateway,
    config.overrides,
    logger,
  );
  // Every reader gets the full analysis of the upload's match (document and events from object
  // storage, Steam bans merged into integrity).
  const integrityRepository = new PgIntegrityRepository(db);
  const matches = new HydratingMatchesRepository(
    new PgMatchesRepository(db),
    workers.analyses,
    workers.events,
    integrityRepository,
  );
  // Replays are stored per match and addressed by upload id.
  const replays = new UploadReplays(matches, workers.replays);
  const uploads = new UploadService(
    matches,
    workers.storage,
    privacy,
    quota,
    platform.uploadLimits,
    new UploadRateLimiter(Date.now, config.overrides?.uploadRate),
    workers.dedupe,
  );
  const sample = new SampleDemoService(
    new FileSampleDemoSource(() => env.sampleDemoFile()),
    aiSettings,
    matches,
    workers.storage,
    privacy,
    quota,
    maxBytes,
    workers.dedupe,
  );
  const coaching = new PgCoachingRepository(db);
  const coachPlans = new CoachPlansService(new PgCoachPlansRepository(db));
  // Personal features read only the account's own ("mine") matches.
  const ownership = new OwnershipService(new PgOwnershipRepository(db), logger);
  const mineHistory = new MineOnlyHistory(matches, ownership);
  // Own matches as rows (ids and dates, indexed; no documents loaded).
  const mineMatches = async (ownerId: string, limit: number) => {
    const mine = await ownership.mine(ownerId);
    return (await matches.completedRows(ownerId, limit, [...mine.keys()])).map(
      (row) => ({ id: row.id, createdAt: row.createdAt }),
    );
  };
  const reviewAi = new SettingsReviewAi(aiSettings);
  const teamReviews = new PgTeamReviewRepository(db);
  const teamGateway: TeamAiGateway =
    "teamReview" in aiGateway
      ? (aiGateway as unknown as TeamAiGateway)
      : new CoachingAiGateway();
  const teams = new TeamReviewService({
    reviews: teamReviews,
    history: matches,
    quota,
    credits: credits.credits,
    ai: aiAccess,
    gateway: teamGateway,
    reviewAi,
    logger,
  });
  const personalization = new PersonalizationService(
    coaching,
    mineHistory,
    coachPlans,
  );
  const features = {
    perMapLearning: (id: string) => plans.feature(id, "perMapLearning"),
    deepHistory: (id: string) => plans.feature(id, "deepHistory"),
    reel: (id: string) => plans.feature(id, "reel"),
  };
  const reviewService = new ReviewService({
    coaching,
    history: matches,
    personalization,
    quota,
    credits: credits.credits,
    features,
    ai: aiAccess,
    gateway: aiGateway,
    replays,
    logger,
    reviewAi,
    teamRatings: teamReviews,
  });
  const autoReviewRepository = new PgAutoReviewRepository(db);
  const autoReviews = new AutoReviewService(
    autoReviewRepository,
    ownership,
    reviewService,
    logger,
  );
  const reports = new ReportsService(
    new PgReportsRepository(db),
    mineHistory,
    {
      playerSteamId: async (ownerId) =>
        (await coaching.profile(ownerId)).playerSteamId,
      deepReviewsBetween: (ownerId, steamId, from, to) =>
        coaching.deepReviewsBetween(ownerId, steamId, from, to),
      monthlyReport: (ownerId) => plans.feature(ownerId, "monthlyReport"),
      completedMatches: mineMatches,
    },
    aiAccess,
    aiGateway,
    clock,
    logger,
  );
  const personalCoach = new PersonalCoachService(
    new PgPersonalCoachRepository(db),
    {
      playerSteamId: async (ownerId) =>
        (await coaching.profile(ownerId)).playerSteamId,
      completedMatches: mineMatches,
      completedAnalyses: (ownerId, limit) =>
        mineHistory.completedAnalyses(ownerId, limit),
      reviews: async (ownerId) =>
        (await coaching.reviews(ownerId, 200)).map((r) => {
          const c = r.coaching as {
            plan?: string[];
            planItems?: { text: string; scope?: string; map?: string }[];
          };
          return {
            createdAt: r.createdAt,
            rating: r.rating,
            planItems: c.planItems ?? (c.plan ?? []).map((text) => ({ text })),
          };
        }),
      deepReviews: (ownerId, steamId) =>
        coaching.deepReviewsBetween(
          ownerId,
          steamId,
          "1970-01-01T00:00:00Z",
          "9999-12-31T00:00:00Z",
        ),
      liveCalls: async (ownerId) =>
        (await coaching.liveCalls(ownerId, 1000)).length,
      enabled: (ownerId) => plans.feature(ownerId, "personalCoach"),
      settings: () => aiSettings.settings(),
    },
    aiAccess,
    aiGateway,
    clock,
    logger,
  );
  const accountJobs = new DailyJobsWorker(
    plans,
    credits.credits,
    reports,
    logger,
    personalCoach,
  );
  // Steam ban checks of match participants need the internet: API process, hourly.
  const banChecks = new BanCheckJob(
    integrityRepository,
    new SteamPlayerBans(
      () => platform.integrationConfig.steamWebApiKey(),
      () => config.steamFetch ?? fetch,
    ),
    logger,
  );
  const daily = {
    async run(): Promise<void> {
      await accountJobs.run();
      await banChecks.run().catch((error: unknown) => {
        logger.info({ err: String(error) }, "steam ban checks failed");
      });
    },
  };
  return {
    maxBytes,
    workers,
    matchesController: new MatchesController(
      new MatchesService(
        matches,
        workers.storage,
        platform.audit,
        logger,
        workers.pipeline,
      ),
      uploads,
      sample,
      guards,
    ),
    analysesController: new AnalysesController(
      new AnalysesService(matches),
      guards,
      new IntegrityService(matches, integrityRepository),
    ),
    aiStatusController: new AiStatusController(aiAccess, guards),
    coachingController: new CoachingController(
      new CoachProfileService(coaching, autoReviewRepository),
      new ProgressService(coaching, matches, coachPlans, ownership),
      reviewService,
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
      new ReelService(matches, features),
    ),
    reportsController: new ReportsController(reports, guards),
    ownership,
    autoReviews,
    aiQualityController: new AiQualityController(
      new AiQualityService(
        new PgAiQualityRepository(db),
        aiSettings,
        matches,
        platform.audit,
      ),
    ),
    followUp: new CoachFollowUpWorker(ownership, autoReviews, logger),
    coachExtrasController: new CoachExtrasController(
      ownership,
      teams,
      guards,
      autoReviews,
    ),
    personalCoachController: new PersonalCoachController(personalCoach, guards),
    daily,
    feedbackController: new FeedbackController(
      new FeedbackService(new PgFeedbackRepository(db)),
    ),
    replayController: new ReplayController(
      new ReplayService(new MatchesReplayRepository(matches), replays),
    ),
  };
}
export type JobsContext = ReturnType<typeof createJobsContext>;
