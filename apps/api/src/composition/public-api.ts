import type { ApiConfig } from "../config/api-config.js";
import type { RuntimeEnv } from "../config/env.js";
import { SwaggerAssets } from "../infrastructure/docs/swagger-assets.js";
import { HttpWebhookTransport } from "../infrastructure/http/webhook-transport.js";
import { AesGcmSecretCipher } from "../infrastructure/secrets/aes-gcm-secret-cipher.js";
import { HmacApiKeyHasher } from "../infrastructure/secrets/api-key-hasher.js";
import { HmacIdentityHasher } from "../infrastructure/secrets/identity-hasher.js";
import { ApiKeysController } from "../modules/api-keys/api-keys.controller.js";
import { PgApiKeysRepository } from "../modules/api-keys/api-keys.repository.js";
import { ApiKeysService } from "../modules/api-keys/api-keys.service.js";
import { PgReviewLookup } from "../modules/coaching/review-lookup.repository.js";
import { ViewerPolicy } from "../modules/coaching/viewer.policy.js";
import { PgDemoCatalog } from "../modules/matches/demo-catalog.repository.js";
import { networkOf } from "../modules/matches/upload-rate-limit.js";
import { PgIdempotencyStore } from "../modules/public-api/idempotency.repository.js";
import {
  CachedPlanIds,
  KeyRateLimiter,
} from "../modules/public-api/key-rate-limit.js";
import { publicOpenApiDocument } from "../modules/public-api/openapi/document.js";
import { PublicAccountController } from "../modules/public-api/public-account.controller.js";
import { PublicAccountService } from "../modules/public-api/public-account.service.js";
import { PublicApiGate } from "../modules/public-api/public-api.gate.js";
import { PublicDemosController } from "../modules/public-api/public-demos.controller.js";
import { PublicDemosService } from "../modules/public-api/public-demos.service.js";
import { PublicReviewsService } from "../modules/public-api/public-reviews.service.js";
import { WebhookDeliverer } from "../modules/webhooks/webhook-deliverer.js";
import { WebhooksController } from "../modules/webhooks/webhooks.controller.js";
import { PgWebhooksRepository } from "../modules/webhooks/webhooks.repository.js";
import { WebhooksService } from "../modules/webhooks/webhooks.service.js";
import type { Db } from "../shared/db/database.js";
import type { Logger } from "../shared/logging/logger.js";
import { WebhookDeliveryWorker } from "../workers/webhook-delivery.worker.js";
import type { JobsContext } from "./jobs.js";
import type { PlatformContext } from "./platform.js";

/**
 * Personal API keys, the public /api/v1 surface, webhooks and the API docs. Every operation
 * delegates to the services the web app uses (uploads, analyses, reviews, progress, credits).
 */
export function createPublicApiContext(
  config: ApiConfig,
  db: Db,
  platform: PlatformContext,
  jobs: JobsContext,
  env: RuntimeEnv,
  logger: Logger,
) {
  const baseUrl = (config.apiPublicUrl ?? "http://127.0.0.1:4000").replace(
    /\/$/,
    "",
  );
  const allowPrivate = config.webhooks?.allowPrivateNetworks ?? false;
  const policy = { allowPrivateNetworks: allowPrivate };
  const identity = new HmacIdentityHasher(() => env.raw());
  const keysRepository = new PgApiKeysRepository(db);
  const keys = new ApiKeysService(
    keysRepository,
    new HmacApiKeyHasher(() => env.raw()),
    platform.clock,
    { network: (ip) => identity.hash("api-net", networkOf(ip)) ?? null },
    { baseUrl: `${baseUrl}/api/v1`, docsUrl: `${baseUrl}/api/docs` },
  );
  const cipher = new AesGcmSecretCipher(() => env.raw());
  const webhookRepository = new PgWebhooksRepository(db);
  const deliverer = new WebhookDeliverer(
    webhookRepository,
    cipher,
    config.webhooks?.transport ?? new HttpWebhookTransport({ allowPrivate }),
    policy,
    baseUrl,
  );
  const webhooks = new WebhooksService(
    webhookRepository,
    cipher,
    deliverer,
    policy,
    keysRepository,
  );
  const idempotency = new PgIdempotencyStore(db);
  const catalog = new PgDemoCatalog(db);
  const viewer = ViewerPolicy.for(false);
  const { services } = jobs;
  const demos = new PublicDemosService(
    catalog,
    { get: (ownerId, id) => services.analyses.get(ownerId, id, viewer) },
    {
      lobby: (ownerId, id, steamId) =>
        services.teams.lobby(ownerId, id, steamId),
    },
    baseUrl,
  );
  const reviews = new PublicReviewsService(
    {
      player: (ownerId, demoId, steamId, lang, tier) =>
        services.reviews.review(ownerId, demoId, steamId, lang, viewer, tier),
      team: (ownerId, demoId, steamId, lang) =>
        services.teams.review(ownerId, demoId, steamId, lang, viewer),
    },
    new PgReviewLookup(db),
    async (ownerId, id) => !!(await catalog.summary(ownerId, id)),
    (payload) => viewer.coaching(payload),
    baseUrl,
  );
  const account = new PublicAccountService({
    me: (ownerId) => platform.users.me(ownerId),
    ledger: (ownerId, limit) => platform.credits.credits.ledger(ownerId, limit),
    progress: (ownerId, map) =>
      services.progress.progress(ownerId, viewer, map),
  });
  const webhooksController = new WebhooksController(webhooks);
  const gate = new PublicApiGate(
    keys,
    new KeyRateLimiter(),
    new CachedPlanIds(
      async (ownerId) => (await platform.plans.effective(ownerId)).id,
    ),
  );
  const document = publicOpenApiDocument(baseUrl);
  return {
    apiKeysController: new ApiKeysController(keys),
    webhooksController,
    docs: new SwaggerAssets(),
    delivery: new WebhookDeliveryWorker(webhookRepository, deliverer, logger, {
      async purge() {
        await idempotency.purge();
        await keysRepository.purgeEvents();
      },
    }),
    controllers: {
      gate,
      demos: new PublicDemosController(demos, services.uploads, idempotency),
      account: new PublicAccountController(reviews, account),
      webhooks: webhooksController,
      openApi: () => document,
      maxUploadBytes: jobs.maxBytes,
    },
  };
}
export type PublicApiContext = ReturnType<typeof createPublicApiContext>;
