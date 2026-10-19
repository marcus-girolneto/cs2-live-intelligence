import type { ApiConfig } from "../config/api-config.js";
import type { RuntimeEnv } from "../config/env.js";
import { CoachingAiGateway } from "../infrastructure/ai/coaching-ai-gateway.js";
import { HttpModelCatalog } from "../infrastructure/ai/model-catalog.js";
import {
  createPaymentGateway,
  paymentMethodsFromEnv,
} from "../infrastructure/billing/payment-gateway-factory.js";
import { AesGcmSecretCipher } from "../infrastructure/secrets/aes-gcm-secret-cipher.js";
import { HttpSteamClient } from "../infrastructure/steam/http-steam-client.js";
import { AdminController } from "../modules/admin/admin.controller.js";
import { PgAdminRepository } from "../modules/admin/admin.repository.js";
import { AdminService } from "../modules/admin/admin.service.js";
import { AiAccessService } from "../modules/ai-config/ai-access.service.js";
import { AiAdminController } from "../modules/ai-config/ai-admin.controller.js";
import { AiConfigFactory } from "../modules/ai-config/ai-config.factory.js";
import { PgAiConfigRepository } from "../modules/ai-config/ai-config.repository.js";
import { AiProviderAdminService } from "../modules/ai-config/ai-provider-admin.service.js";
import {
  AiSettingsService,
  AssignedProviderSource,
  EnvironmentSource,
} from "../modules/ai-config/ai-settings.service.js";
import { AppSettingsService } from "../modules/ai-config/app-settings.service.js";
import { AuthController } from "../modules/auth/auth.controller.js";
import { PgAuthRepository } from "../modules/auth/auth.repository.js";
import { AuthService } from "../modules/auth/auth.service.js";
import { BillingController } from "../modules/billing/billing.controller.js";
import { PgBillingRepository } from "../modules/billing/billing.repository.js";
import { BillingService } from "../modules/billing/billing.service.js";
import { DevicesController } from "../modules/devices/devices.controller.js";
import { PgDevicesRepository } from "../modules/devices/devices.repository.js";
import { DevicesService } from "../modules/devices/devices.service.js";
import { PlanAccountExtras } from "../modules/plans/plans.extras.js";
import { PlansController } from "../modules/plans/plans.controller.js";
import { PgPlansRepository } from "../modules/plans/plans.repository.js";
import { PlansService } from "../modules/plans/plans.service.js";
import { PrivacyController } from "../modules/privacy/privacy.controller.js";
import { PgPrivacyRepository } from "../modules/privacy/privacy.repository.js";
import { PrivacyService } from "../modules/privacy/privacy.service.js";
import { PgUsageRepository } from "../modules/usage/usage.repository.js";
import { QuotaService } from "../modules/usage/usage.service.js";
import { UsersController } from "../modules/users/users.controller.js";
import { PgUsersRepository } from "../modules/users/users.repository.js";
import { UsersService } from "../modules/users/users.service.js";
import { ZonedClock } from "../shared/clock/clock.js";
import type { Db } from "../shared/db/database.js";
import { PgUnitOfWork } from "../shared/db/unit-of-work.js";
import { AuthGuards } from "../shared/http/guards.js";
import type { Logger } from "../shared/logging/logger.js";
import type { LiveContext } from "./live.js";

/**
 * Database-backed account, plan/billing, AI configuration and admin modules: repositories →
 * services → controllers, wired by constructor injection.
 */
export function createPlatformContext(
  config: ApiConfig,
  db: Db,
  live: LiveContext,
  env: RuntimeEnv,
  logger: Logger,
) {
  const authRepository = new PgAuthRepository(db);
  const usersRepository = new PgUsersRepository(db);
  const devicesRepository = new PgDevicesRepository(db);
  const guards = new AuthGuards(
    authRepository,
    usersRepository,
    devicesRepository,
  );
  const apiPublicUrl = config.apiPublicUrl ?? "http://127.0.0.1:4000";

  const clock = config.clock ?? new ZonedClock(env.timeZone());
  const plans = new PlansService(
    new PgPlansRepository(db),
    clock,
    new PgUnitOfWork(db, (tx) => new PgPlansRepository(tx)),
  );
  const quota = new QuotaService(new PgUsageRepository(db), plans, clock);
  const accountExtras = new PlanAccountExtras(plans, quota);
  const raw = env.raw();
  const billing = new BillingService(
    createPaymentGateway(raw, config.paymentGateway),
    plans,
    new PgBillingRepository(db),
    {
      webOrigin: config.webOrigin.replace(/\/$/, ""),
      paymentMethods: {
        BRL: paymentMethodsFromEnv(raw.STRIPE_PAYMENT_METHODS_BRL),
        USD: paymentMethodsFromEnv(raw.STRIPE_PAYMENT_METHODS_USD),
      },
      env: raw,
    },
  );

  const aiRepository = new PgAiConfigRepository(db);
  const cipher = new AesGcmSecretCipher(() => env.raw());
  const factory = new AiConfigFactory(cipher, env);
  const aiSettings = new AiSettingsService(aiRepository, [
    new AssignedProviderSource(factory),
    new EnvironmentSource(factory),
  ]);
  const aiGateway = config.aiGateway ?? new CoachingAiGateway();
  const adminRepository = new PgAdminRepository(db);

  const steam = new HttpSteamClient(config.steamFetch, () =>
    env.steamWebApiKey(),
  );
  const users = new UsersService(usersRepository, steam, accountExtras);
  const privacy = new PgPrivacyRepository(db);
  return {
    guards,
    users,
    plans,
    quota,
    privacy,
    aiSettings,
    aiGateway,
    audit: adminRepository,
    aiAccess: new AiAccessService(aiSettings, aiRepository, aiGateway, logger),
    authController: new AuthController(
      new AuthService(
        authRepository,
        steam,
        users,
        live.invalidation,
        env,
        apiPublicUrl,
      ),
      config.webOrigin,
      apiPublicUrl,
    ),
    usersController: new UsersController(users),
    devicesController: new DevicesController(
      new DevicesService(devicesRepository, live.invalidation),
    ),
    privacyController: new PrivacyController(
      new PrivacyService(privacy, live.invalidation, plans),
    ),
    plansController: new PlansController(plans),
    billingController: new BillingController(billing),
    adminController: new AdminController(
      new AdminService(
        adminRepository,
        new PgUnitOfWork(db, (tx) => new PgAdminRepository(tx)),
        accountExtras,
        aiSettings,
      ),
    ),
    aiAdminController: new AiAdminController(
      new AiProviderAdminService(
        aiRepository,
        aiSettings,
        factory,
        cipher,
        aiGateway,
        new HttpModelCatalog(config.fetch ?? fetch),
        adminRepository,
      ),
      new AppSettingsService(
        aiRepository,
        aiSettings,
        adminRepository,
        () => !!env.sampleDemoFile(),
      ),
    ),
  };
}
export type PlatformContext = ReturnType<typeof createPlatformContext>;
