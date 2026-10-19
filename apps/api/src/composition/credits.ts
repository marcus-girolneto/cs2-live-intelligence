import type { RuntimeEnv } from "../config/env.js";
import { HmacIdentityHasher } from "../infrastructure/secrets/identity-hasher.js";
import { PgCreditSettingsRepository } from "../modules/credits/credit-settings.repository.js";
import { CreditSettingsService } from "../modules/credits/credit-settings.service.js";
import { CreditsController } from "../modules/credits/credits.controller.js";
import { PgCreditsRepository } from "../modules/credits/credits.repository.js";
import { CreditsService } from "../modules/credits/credits.service.js";
import { PgWelcomeRepository } from "../modules/credits/welcome.repository.js";
import {
  WelcomeService,
  type ProfileSource,
} from "../modules/credits/welcome.service.js";
import { PgUsersRepository } from "../modules/users/users.repository.js";
import type { PlansService } from "../modules/plans/plans.service.js";
import type { Clock } from "../shared/clock/clock.js";
import type { Db } from "../shared/db/database.js";
import type { Logger } from "../shared/logging/logger.js";
import type { AuditTrail } from "../shared/ports/audit-trail.js";

/** Credit settings + packs (needed before plans and usage: costs and the daily safety cap). */
export function createCreditSettings(db: Db, audit: AuditTrail) {
  return new CreditSettingsService(new PgCreditSettingsRepository(db), audit);
}

/**
 * The credits wallet and welcome credits. Plans are notified of admin grants (monthly credits)
 * through `plans.useCredits`; the welcome service reads profiles through `profiles`.
 */
export function createCreditsContext(
  db: Db,
  settings: CreditSettingsService,
  plans: PlansService,
  clock: Clock,
  audit: AuditTrail,
  env: RuntimeEnv,
  profiles: ProfileSource,
  logger: Logger,
) {
  const repository = new PgCreditsRepository(db);
  const users = new PgUsersRepository(db);
  const credits = new CreditsService(
    repository,
    settings,
    plans,
    clock,
    audit,
    undefined,
    {
      steamLinked: async (ownerId) =>
        !!(await users.account(ownerId).catch(() => undefined))?.steamId,
    },
  );
  const welcome = new WelcomeService(
    repository,
    new PgWelcomeRepository(db),
    settings,
    new HmacIdentityHasher(() => env.raw()),
    profiles,
    clock,
    logger,
  );
  credits.useWelcome(welcome);
  plans.useCredits(settings, {
    planGranted: (ownerId) => credits.syncPlanCredits(ownerId),
  });
  return {
    credits,
    welcome,
    settings,
    creditsController: new CreditsController(credits, settings),
  };
}
export type CreditsContext = ReturnType<typeof createCreditsContext>;
