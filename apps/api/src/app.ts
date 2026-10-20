import Fastify, { type FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import type { ApiConfig } from "./config/api-config.js";
import {
  createContainer,
  startContainerWorkers,
  type Container,
} from "./container.js";
import type { JobsContext } from "./composition/jobs.js";
import type { PlatformContext } from "./composition/platform.js";
import { registerAdminRoutes } from "./modules/admin/admin.routes.js";
import {
  registerAiAdminRoutes,
  registerAiStatusRoutes,
} from "./modules/ai-config/ai-config.routes.js";
import { registerAnalysesRoutes } from "./modules/analyses/analyses.routes.js";
import {
  installAuthRateLimit,
  registerAuthRoutes,
} from "./modules/auth/auth.routes.js";
import {
  registerStaticAuthRoutes,
  StaticLogoutController,
} from "./modules/auth/static-auth.routes.js";
import { registerBillingRoutes } from "./modules/billing/billing.routes.js";
import { registerCoachingRoutes } from "./modules/coaching/coaching.routes.js";
import { registerTrainingRoutes } from "./modules/training/training.routes.js";
import { registerCoachExtrasRoutes } from "./modules/coaching/coach-extras.routes.js";
import { registerAiQualityRoutes } from "./modules/ai-config/ai-quality.controller.js";
import { registerCreditsRoutes } from "./modules/credits/credits.routes.js";
import { registerReportsRoutes } from "./modules/reports/reports.routes.js";
import { registerPersonalCoachRoutes } from "./modules/personal-coach/personal-coach.routes.js";
import { registerDevicesRoutes } from "./modules/devices/devices.routes.js";
import { registerFeedbackRoutes } from "./modules/feedback/feedback.routes.js";
import { registerIntegrationsRoutes } from "./modules/integrations/integrations.routes.js";
import { registerLiveRoutes } from "./modules/live/live.routes.js";
import { registerMatchesRoutes } from "./modules/matches/matches.routes.js";
import { registerPlansRoutes } from "./modules/plans/plans.routes.js";
import { registerPrivacyRoutes } from "./modules/privacy/privacy.routes.js";
import { registerReplayRoutes } from "./modules/replay/replay.routes.js";
import { registerSystemRoutes } from "./modules/system/system.routes.js";
import { registerTelemetryRoutes } from "./modules/telemetry/telemetry.routes.js";
import { registerUsersRoutes } from "./modules/users/users.routes.js";
import { registerApiKeysRoutes } from "./modules/api-keys/api-keys.routes.js";
import { registerDocsRoutes } from "./modules/public-api/docs.routes.js";
import {
  registerPublicApi,
  type PublicRoute,
} from "./modules/public-api/public-api.routes.js";
import { registerWebhookSessionRoutes } from "./modules/webhooks/webhooks.routes.js";
import type { PublicApiContext } from "./composition/public-api.js";
import { installErrorHandler } from "./shared/errors/index.js";
import { AuthGuards } from "./shared/http/guards.js";
import { installRequestLogging } from "./shared/logging/metrics.js";

export type { ApiConfig, JobOptions } from "./config/api-config.js";

declare module "fastify" {
  interface FastifyInstance {
    /** Routes registered under /api/v1 (the OpenAPI spec test compares them to the document). */
    publicApiRoutes: PublicRoute[];
  }
}
export { project } from "./modules/telemetry/projection.js";

/** Builds the container from `config`, then the HTTP app around it. */
export async function buildApp(config: ApiConfig): Promise<FastifyInstance> {
  return buildHttpApp(createContainer(config));
}

function registerPlatform(
  app: FastifyInstance,
  platform: PlatformContext,
): void {
  const { guards } = platform;
  installAuthRateLimit(app);
  registerAuthRoutes(app, platform.authController, guards);
  registerUsersRoutes(app, platform.usersController, guards);
  registerPrivacyRoutes(app, platform.privacyController, guards);
  registerDevicesRoutes(app, platform.devicesController, guards);
  app.addHook("onClose", async () => {
    await platform.users.drain();
    await platform.credits.welcome.drain();
  });
  registerAdminRoutes(app, platform.adminController, guards);
}

async function registerJobs(
  app: FastifyInstance,
  container: Container,
  jobs: JobsContext,
  guards: AuthGuards,
): Promise<void> {
  registerMatchesRoutes(app, jobs.matchesController, guards, jobs.maxBytes);
  registerAnalysesRoutes(app, jobs.analysesController, guards);
  registerCoachingRoutes(app, jobs.coachingController, guards);
  registerTrainingRoutes(app, jobs.trainingController, guards);
  registerCoachExtrasRoutes(app, jobs.coachExtrasController, guards);
  registerAiQualityRoutes(app, jobs.aiQualityController, guards);
  registerFeedbackRoutes(app, jobs.feedbackController, guards);
  registerAiStatusRoutes(app, jobs.aiStatusController, guards);
  registerReplayRoutes(app, jobs.replayController, guards.withStyle("coded"));
  registerReportsRoutes(app, jobs.reportsController, guards.withStyle("coded"));
  registerPersonalCoachRoutes(
    app,
    jobs.personalCoachController,
    guards.withStyle("coded"),
  );
  if (container.publicApi)
    await registerPublicSurface(app, container.publicApi, guards, container);
  const worker = await startContainerWorkers(jobs, container.config.jobs!);
  app.addHook("onClose", async () => worker.stop());
  container.metrics.addGauge(
    () =>
      `cs2_demo_jobs_complete_total ${worker.counters.complete}\ncs2_demo_jobs_failed_total ${worker.counters.failed}\ncs2_worker_errors_total ${worker.counters.errors}\n`,
  );
}

/** Settings → Developers session routes, /api/v1, the API docs and webhook delivery. */
async function registerPublicSurface(
  app: FastifyInstance,
  publicApi: PublicApiContext,
  guards: AuthGuards,
  container: Container,
): Promise<void> {
  const coded = guards.withStyle("coded");
  registerApiKeysRoutes(app, publicApi.apiKeysController, coded);
  registerWebhookSessionRoutes(app, publicApi.webhooksController, coded);
  await registerPublicApi(app, publicApi.controllers, app.publicApiRoutes);
  registerDocsRoutes(app, publicApi.docs);
  if (!container.config.jobs?.disableWorker) publicApi.delivery.start();
  app.addHook("onClose", async () => publicApi.delivery.stop());
}

/**
 * The Fastify instance: plugins, the single error handler and every module's route table.
 * Hook order matters on shutdown (Fastify runs onClose hooks in reverse): the database is
 * registered first so it closes last, after workers and in-flight profile refreshes.
 */
export async function buildHttpApp(
  container: Container,
): Promise<FastifyInstance> {
  const { config, live, platform, jobs, metrics, database } = container;
  const app = Fastify({ bodyLimit: 256 * 1024, logger: false });
  app.decorate("publicApiRoutes", [] as PublicRoute[]);
  if (database && config.closeDatabaseOnClose)
    app.addHook("onClose", async () => database.close());
  installErrorHandler(app);
  await app.register(websocket, { options: { maxPayload: 1024 } });

  const identity = container.staticIdentity;
  const guards =
    platform?.guards ?? new AuthGuards(identity!, identity!, identity!);
  if (platform) {
    registerPlatform(app, platform);
    registerAiAdminRoutes(app, platform.aiAdminController, guards);
    const coded = guards.withStyle("coded");
    // Admin-managed settings read synchronously (the clock's zone) are loaded before serving.
    await platform.timeZone.refresh();
    registerIntegrationsRoutes(app, platform.integrationsController, coded);
    registerPlansRoutes(app, platform.plansController, coded);
    registerCreditsRoutes(app, platform.credits.creditsController, coded);
    await registerBillingRoutes(app, platform.billingController, coded);
  }
  if (jobs) await registerJobs(app, container, jobs, guards);
  else
    metrics.addGauge(
      () =>
        "cs2_demo_jobs_complete_total 0\ncs2_demo_jobs_failed_total 0\ncs2_worker_errors_total 0\n",
    );

  installRequestLogging(app, metrics, config.enableLogs ?? false);
  registerSystemRoutes(app, metrics, database);
  if (identity)
    registerStaticAuthRoutes(
      app,
      new StaticLogoutController(identity, live.invalidation),
      guards,
    );
  registerLiveRoutes(app, live.liveController, guards);
  registerTelemetryRoutes(app, live.telemetryController, guards);
  app.addHook("onClose", async () => live.broadcaster.close());
  return app;
}
