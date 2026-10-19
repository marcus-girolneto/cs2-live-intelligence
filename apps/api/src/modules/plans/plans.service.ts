import type { Clock } from "../../shared/clock/clock.js";
import {
  DirectUnitOfWork,
  type UnitOfWork,
} from "../../shared/db/unit-of-work.js";
import { NotFoundError, ValidationError } from "../../shared/errors/index.js";
import {
  FALLBACK_FREE,
  FREE_PLAN_ID,
  PlanPolicy,
  type LimitKey,
} from "./plan.policy.js";
import { FEATURE_KEYS } from "./plans.dto.js";
import type {
  AccountPlanSummary,
  AccountPlanView,
  AdminPlanView,
  EffectivePlan,
  PlanFeatures,
  PlanGrant,
  PlanUpdate,
  PlanView,
  SubscriptionSource,
  SubscriptionStatus,
} from "./plans.dto.js";
import type {
  PlanRecord,
  PlansRepository,
  SubscriptionRecord,
} from "./plans.repository.js";

export { FREE_PLAN_ID, type LimitKey } from "./plan.policy.js";
const CODED = {
  notFound: { code: "not_found" },
  invalid: { code: "invalid_request" },
} as const;

export type ProviderState = {
  ownerId: string;
  planId: string;
  status: SubscriptionStatus;
  source: SubscriptionSource;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

/** Port (credits): the admin-editable review costs shown in the plan comparison. */
export interface CreditCosts {
  costs(): Promise<{
    quickCost: number;
    deepCost: number;
    proDeepCost: number;
  }>;
}
const DEFAULT_COSTS: CreditCosts = {
  costs: async () => ({ quickCost: 1, deepCost: 3, proDeepCost: 2 }),
};
const view = (
  p: PlanRecord,
  costs: { quickCost: number; deepCost: number; proDeepCost: number },
): PlanView => ({
  id: p.id,
  name: p.name,
  prices: p.prices,
  limits: p.limits,
  features: p.features,
  credits: {
    monthly: p.limits.monthlyCredits,
    quickCost: PlanPolicy.reviewCost(p, "quick", costs),
    deepCost: PlanPolicy.reviewCost(p, "deep", costs),
  },
  benefits: FEATURE_KEYS.filter((k) => p.features[k]),
});

/** Observer (credits): an admin granted a plan (monthly credits may be due now). */
export interface PlanGrantListener {
  planGranted(ownerId: string): Promise<unknown>;
}

/** Plan catalogue, account entitlements (via PlanPolicy), admin grants and provider state. */
export class PlansService {
  constructor(
    private readonly repo: PlansRepository,
    private readonly clock: Clock,
    private readonly transaction: UnitOfWork<PlansRepository> = new DirectUnitOfWork(
      repo,
    ),
    private credits: CreditCosts = DEFAULT_COSTS,
    private grantListener?: PlanGrantListener,
  ) {}

  /** Late binding (credits are built after plans). */
  useCredits(costs: CreditCosts, listener: PlanGrantListener): void {
    this.credits = costs;
    this.grantListener = listener;
  }

  /** Active plans for signed-in users, in display order. */
  async publicPlans(): Promise<PlanView[]> {
    const costs = await this.credits.costs();
    return (await this.repo.listPlans())
      .filter((p) => p.active)
      .map((p) => view(p, costs));
  }
  async adminPlans(): Promise<AdminPlanView[]> {
    const costs = await this.credits.costs();
    return (await this.repo.listPlans()).map((p) => ({
      ...view(p, costs),
      active: p.active,
      sort: p.sort,
      stripePrices: p.stripePrices,
    }));
  }
  plan(id: string): Promise<PlanRecord | undefined> {
    return this.repo.getPlan(id);
  }
  subscription(ownerId: string): Promise<SubscriptionRecord | undefined> {
    return this.repo.subscription(ownerId);
  }
  findSubscriptionByStripe(ref: {
    customerId?: string | null;
    subscriptionId?: string | null;
  }): Promise<SubscriptionRecord | undefined> {
    return this.repo.findSubscriptionByStripe(ref);
  }
  /** True when the subscription currently grants its plan. */
  entitled(sub: SubscriptionRecord | undefined): sub is SubscriptionRecord {
    return PlanPolicy.entitled(sub, this.clock.now());
  }

  private async resolve(
    repo: PlansRepository,
    ownerId: string,
  ): Promise<{ sub: SubscriptionRecord | undefined; plan: PlanRecord }> {
    const free = async (): Promise<PlanRecord> =>
      (await repo.getPlan(FREE_PLAN_ID)) ?? FALLBACK_FREE;
    const sub = await repo.subscription(ownerId);
    const plan = this.entitled(sub)
      ? ((await repo.getPlan(sub.planId)) ?? (await free()))
      : await free();
    return { sub, plan };
  }
  private async effectiveIn(
    repo: PlansRepository,
    ownerId: string,
  ): Promise<EffectivePlan> {
    if ((await repo.role(ownerId)) === "admin") return PlanPolicy.admin();
    return PlanPolicy.effective((await this.resolve(repo, ownerId)).plan);
  }

  /** Limits and features that apply to the account; admins are unlimited. */
  effective(ownerId: string): Promise<EffectivePlan> {
    return this.effectiveIn(this.repo, ownerId);
  }
  async perMapLearning(ownerId: string): Promise<boolean> {
    return (await this.effective(ownerId)).features.perMapLearning;
  }
  /** Whether the account's plan (or admin role) has a feature switch. */
  async feature(ownerId: string, key: keyof PlanFeatures): Promise<boolean> {
    return (await this.effective(ownerId)).features[key];
  }
  userExists(ownerId: string): Promise<boolean> {
    return this.repo.userExists(ownerId);
  }
  /** Owners whose subscription currently grants a plan (daily credit/report jobs). */
  async entitledOwners(): Promise<{ ownerId: string; planId: string }[]> {
    return (await this.repo.activeSubscriptions())
      .filter((s) => this.entitled(s))
      .map((s) => ({ ownerId: s.ownerId, planId: s.planId }));
  }

  /** GET /v1/me `plan`. */
  async accountPlan(ownerId: string): Promise<AccountPlanView> {
    const effective = await this.effective(ownerId);
    if (effective.admin)
      return {
        id: effective.id,
        name: effective.name,
        status: "active",
        source: "role",
        limits: effective.limits,
        features: effective.features,
      };
    const { sub, plan } = await this.resolve(this.repo, ownerId);
    const current = this.entitled(sub) && sub.planId === plan.id;
    return {
      id: plan.id,
      name: plan.name,
      status: current ? sub.status : "active",
      source: current ? sub.source : "default",
      ...(current && sub.currentPeriodEnd
        ? { renewsAt: sub.currentPeriodEnd }
        : {}),
      limits: plan.limits,
      features: plan.features,
    };
  }

  /** Account plans for the admin users list, keyed by owner id. */
  async accountPlans(
    ownerIds: string[],
  ): Promise<Map<string, AccountPlanSummary>> {
    const subs = new Map(
      (await this.repo.subscriptions(ownerIds)).map((s) => [s.ownerId, s]),
    );
    const plans = new Map((await this.repo.listPlans()).map((p) => [p.id, p]));
    return new Map(
      ownerIds.map((id) => {
        const sub = subs.get(id);
        const plan = PlanPolicy.applicable(
          sub,
          (planId) => plans.get(planId),
          this.clock.now(),
        );
        const current = this.entitled(sub) && sub.planId === plan.id;
        return [
          id,
          {
            id: plan.id,
            name: plan.name,
            status: current ? sub.status : ("active" as const),
            source: current ? sub.source : ("default" as const),
            ...(current && sub.currentPeriodEnd
              ? { renewsAt: sub.currentPeriodEnd }
              : {}),
          },
        ];
      }),
    );
  }

  /** Next plan in display order with a higher (or unlimited) value for `key`, for the 402 body. */
  async upgradeFor(
    currentId: string,
    key: LimitKey,
    current: number,
  ): Promise<string | null> {
    return PlanPolicy.upgradeFor(
      await this.repo.listPlans(),
      currentId,
      key,
      current,
    );
  }

  /** Retention clamped to the plan maximum (PUT /v1/settings). */
  async clampRetention(ownerId: string, requested: number): Promise<number> {
    return PlanPolicy.clampRetention(await this.effective(ownerId), requested);
  }

  async updatePlan(
    adminId: string,
    id: string,
    patch: PlanUpdate,
  ): Promise<AdminPlanView> {
    const plan = await this.repo.getPlan(id);
    if (!plan) throw new NotFoundError("Plan not found", CODED.notFound);
    if (id === FREE_PLAN_ID && patch.active === false)
      throw new ValidationError(
        "The free plan cannot be deactivated.",
        CODED.invalid,
      );
    const next: PlanRecord = {
      ...plan,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.prices !== undefined ? { prices: patch.prices } : {}),
      ...(patch.stripePrices !== undefined
        ? { stripePrices: patch.stripePrices }
        : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      ...(patch.sort !== undefined ? { sort: patch.sort } : {}),
      limits: { ...plan.limits, ...(patch.limits ?? {}) },
      features: { ...plan.features, ...(patch.features ?? {}) },
    };
    await this.transaction.run(async (repo) => {
      await repo.savePlan(next);
      await repo.audit(adminId, "plan.update", { planId: id, ...patch });
    });
    return (await this.adminPlans()).find((p) => p.id === id)!;
  }

  /** Manual grant by an admin (source "admin"). Granting "free" ends any paid access. */
  async grant(
    adminId: string,
    ownerId: string,
    grant: PlanGrant,
  ): Promise<AccountPlanView> {
    if (!(await this.repo.userExists(ownerId)))
      throw new NotFoundError("User not found", CODED.notFound);
    const plan = await this.repo.getPlan(grant.planId);
    if (!plan) throw new NotFoundError("Plan not found", CODED.notFound);
    const until = grant.until ?? null;
    if (until && Date.parse(until) <= this.clock.now().getTime())
      throw new ValidationError("until must be in the future", CODED.invalid);
    const existing = await this.repo.subscription(ownerId);
    // Subscription, retention clamp and audit entry commit together (Unit of Work).
    await this.transaction.run(async (repo) => {
      await repo.saveSubscription({
        ownerId,
        planId: plan.id,
        status: "active",
        source: "admin",
        currentPeriodEnd: until ? new Date(until).toISOString() : null,
        stripeCustomerId: existing?.stripeCustomerId ?? null,
        stripeSubscriptionId: existing?.stripeSubscriptionId ?? null,
      });
      await this.applyRetention(repo, ownerId);
      await repo.audit(adminId, "user.plan", {
        userId: ownerId,
        planId: plan.id,
        until,
      });
    });
    await this.grantListener?.planGranted(ownerId);
    return this.accountPlan(ownerId);
  }

  /** Writes a subscription state coming from the payment provider (with its retention clamp). */
  async applyProviderState(state: ProviderState): Promise<void> {
    await this.transaction.run(async (repo) => {
      const plan = await repo.getPlan(state.planId);
      await repo.saveSubscription({
        ...state,
        planId: plan ? plan.id : FREE_PLAN_ID,
      });
      await this.applyRetention(repo, state.ownerId);
    });
  }

  /** After a plan change, lowers retention above the new plan's maximum. */
  private async applyRetention(
    repo: PlansRepository,
    ownerId: string,
  ): Promise<void> {
    const max = (await this.effectiveIn(repo, ownerId)).limits.retentionDaysMax;
    if (max !== null) await repo.clampRetention(ownerId, max);
  }
}
