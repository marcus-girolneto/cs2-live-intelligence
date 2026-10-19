import type { AccountExtras } from "../users/users.service.js";
import type { UserPlans } from "../admin/admin.service.js";
import type { QuotaService } from "../usage/usage.service.js";
import type { PlansService } from "./plans.service.js";

/** Adapter: plan + usage on GET /v1/me, and each user's plan on the admin users list. */
export class PlanAccountExtras implements AccountExtras, UserPlans {
  constructor(
    private readonly plans: PlansService,
    private readonly quota: QuotaService,
  ) {}

  async extras(ownerId: string): Promise<Record<string, unknown>> {
    return {
      plan: await this.plans.accountPlan(ownerId),
      usage: await this.quota.usageView(ownerId),
    };
  }

  async withPlans<T extends { id: string }>(
    users: T[],
  ): Promise<Array<T & { plan: unknown }>> {
    const plans = await this.plans.accountPlans(users.map((u) => u.id));
    return users.map((u) => ({ ...u, plan: plans.get(u.id) }));
  }
}
