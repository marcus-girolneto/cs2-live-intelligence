import type { AccountExtras } from "../users/users.service.js";
import type { CreditsView } from "../credits/credits.dto.js";
import type { UserPlans } from "../admin/admin.service.js";
import type { QuotaService } from "../usage/usage.service.js";
import type { PlansService } from "./plans.service.js";

/** Port (credits): the wallet shown on GET /v1/me. */
export interface CreditsExtras {
  view(ownerId: string, steamLinked: boolean): Promise<CreditsView>;
}

/** Adapter: plan, usage and credits on GET /v1/me, and each user's plan on the admin users list. */
export class PlanAccountExtras implements AccountExtras, UserPlans {
  constructor(
    private readonly plans: PlansService,
    private readonly quota: QuotaService,
    private credits?: CreditsExtras,
  ) {}

  /** Late binding (credits are built after plans and usage). */
  useCredits(credits: CreditsExtras): void {
    this.credits = credits;
  }

  async extras(
    ownerId: string,
    account: { steamLinked: boolean } = { steamLinked: false },
  ): Promise<Record<string, unknown>> {
    return {
      plan: await this.plans.accountPlan(ownerId),
      usage: await this.quota.usageView(ownerId),
      ...(this.credits
        ? { credits: await this.credits.view(ownerId, account.steamLinked) }
        : {}),
    };
  }

  async withPlans<T extends { id: string }>(
    users: T[],
  ): Promise<Array<T & { plan: unknown }>> {
    const plans = await this.plans.accountPlans(users.map((u) => u.id));
    return users.map((u) => ({ ...u, plan: plans.get(u.id) }));
  }
}
