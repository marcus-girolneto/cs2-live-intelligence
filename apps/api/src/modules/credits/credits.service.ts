import type { Clock } from "../../shared/clock/clock.js";
import {
  InsufficientCreditsError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors/index.js";
import type { AuditTrail } from "../../shared/ports/audit-trail.js";
import { PlanPolicy } from "../plans/plan.policy.js";
import type { EffectivePlan, PlanLimits } from "../plans/plans.dto.js";
import type {
  PlanRecord,
  SubscriptionRecord,
} from "../plans/plans.repository.js";
import type { CreditSettingsService } from "./credit-settings.service.js";
import { creditPeriod } from "./credit-period.js";
import type {
  AdjustRequest,
  Buckets,
  CreditsView,
  LedgerDto,
  ReviewTier,
  WelcomeView,
} from "./credits.dto.js";
import type { CreditsRepository, CreditResult } from "./credits.repository.js";

/** What credits need from plans. */
export interface CreditPlans {
  effective(ownerId: string): Promise<EffectivePlan>;
  plan(id: string): Promise<PlanRecord | undefined>;
  subscription(ownerId: string): Promise<SubscriptionRecord | undefined>;
  entitled(sub: SubscriptionRecord | undefined): sub is SubscriptionRecord;
  upgradeFor(
    currentId: string,
    key: keyof Omit<PlanLimits, "retentionDaysMax">,
    current: number,
  ): Promise<string | null>;
  userExists(ownerId: string): Promise<boolean>;
}
/** Port (welcome): the welcome-credit state shown on GET /v1/me. */
export interface WelcomeState {
  view(ownerId: string, steamLinked: boolean): Promise<WelcomeView>;
}
/** Credits reserved for one AI review: commit after success, release on failure. */
export interface CreditHold {
  readonly tier: ReviewTier;
  readonly cost: number;
  /** Charges the hold (ledger ref = the review id); returns the credits spent. */
  commit(ref: string): Promise<number>;
  release(): Promise<void>;
}

/** In-flight holds expire after this (a crashed process cannot lock credits forever). */
export const HOLD_TTL_MS = 10 * 60 * 1000;
const sum = (b: Buckets) => b.plan + b.bonus + b.purchased;
const FREE_HOLD = (tier: ReviewTier): CreditHold => ({
  tier,
  cost: 0,
  commit: async () => 0,
  release: async () => undefined,
});

/**
 * The credits wallet: balance by bucket, review costs, reserve → commit/release around AI
 * reviews, plan period grants, pack purchases and audited admin adjustments. The ledger is
 * the source of truth; the repository keeps the wallet row in the same transaction.
 */
export class CreditsService {
  constructor(
    private readonly repository: CreditsRepository,
    private readonly settings: CreditSettingsService,
    private readonly plans: CreditPlans,
    private readonly clock: Clock,
    private readonly audit: AuditTrail,
    private welcome?: WelcomeState,
    /** Whether an account signed in through Steam (admin views of other users). */
    private readonly accounts?: {
      steamLinked(ownerId: string): Promise<boolean>;
    },
  ) {}

  /** Late binding (the welcome service is built after this one). */
  useWelcome(welcome: WelcomeState): void {
    this.welcome = welcome;
  }

  /** Review costs on the account's plan. */
  async costs(ownerId: string): Promise<Record<ReviewTier, number>> {
    const [plan, settings] = await Promise.all([
      this.plans.effective(ownerId),
      this.settings.settings(),
    ]);
    return {
      quick: PlanPolicy.reviewCost(plan, "quick", settings),
      deep: PlanPolicy.reviewCost(plan, "deep", settings),
      team: PlanPolicy.reviewCost(plan, "team", settings),
    };
  }

  /** GET /v1/me `credits`. */
  async view(ownerId: string, steamLinked: boolean): Promise<CreditsView> {
    const wallet = await this.repository.wallet(ownerId, this.clock.now());
    return {
      balance: sum(wallet.balances),
      buckets: wallet.balances,
      ...(wallet.planExpiresAt && wallet.balances.plan > 0
        ? { planExpiresAt: wallet.planExpiresAt }
        : {}),
      welcome: this.welcome
        ? await this.welcome.view(ownerId, steamLinked)
        : { status: "pending", reason: "not_evaluated" },
      costs: await this.costs(ownerId),
    };
  }

  /**
   * Reserves the tier's cost before a model call (402 insufficient_credits when it does not
   * fit). Administrators are not charged. Concurrent reservations serialize on the wallet row.
   */
  async reserve(ownerId: string, tier: ReviewTier): Promise<CreditHold> {
    const plan = await this.plans.effective(ownerId);
    if (plan.admin) return FREE_HOLD(tier);
    const cost = PlanPolicy.reviewCost(
      plan,
      tier,
      await this.settings.settings(),
    );
    const hold = await this.repository.reserve(
      ownerId,
      cost,
      `review_${tier}`,
      this.clock.now(),
      HOLD_TTL_MS,
    );
    if (!hold) {
      const wallet = await this.repository.wallet(ownerId, this.clock.now());
      throw new InsufficientCreditsError({
        tier,
        needed: cost,
        balance: sum(wallet.free),
        packs: await this.settings.packs(),
        upgradeTo: await this.plans.upgradeFor(
          plan.id,
          "monthlyCredits",
          plan.limits.monthlyCredits,
        ),
      });
    }
    let done = false;
    return {
      tier,
      cost,
      commit: async (ref: string) => {
        if (done) return 0;
        done = true;
        const charged = await this.repository.commit(
          ownerId,
          { ...hold, amount: cost },
          `review_${tier}`,
          ref,
          this.clock.now(),
        );
        return charged ? sum(charged) : 0;
      },
      release: async () => {
        if (done) return;
        done = true;
        await this.repository.release(ownerId, hold.id);
      },
    };
  }

  async balance(ownerId: string): Promise<number> {
    return sum(
      (await this.repository.wallet(ownerId, this.clock.now())).balances,
    );
  }

  async ledger(ownerId: string, limit: number): Promise<LedgerDto> {
    return { entries: await this.repository.ledger(ownerId, limit) };
  }

  /** POST /v1/admin/users/:id/credits: audited ledger admin_adjust (default bucket bonus). */
  async adjust(
    adminId: string,
    userId: string,
    request: AdjustRequest,
  ): Promise<{ userId: string; result: CreditResult; credits: CreditsView }> {
    if (!(await this.plans.userExists(userId)))
      throw new NotFoundError("User not found", { code: "not_found" });
    const bucket = request.bucket ?? "bonus";
    const result = await this.repository.credit(
      {
        ownerId: userId,
        delta: request.delta,
        reason: "admin_adjust",
        bucket,
        note: request.note,
        adminId,
      },
      this.clock.now(),
    );
    if (result === "insufficient")
      throw new ValidationError(
        `The ${bucket} bucket does not have ${-request.delta} free credits.`,
        { code: "insufficient_credits" },
      );
    await this.audit.record(adminId, "credits.adjust", {
      userId,
      delta: request.delta,
      bucket,
      note: request.note,
    });
    const steamLinked = (await this.accounts?.steamLinked(userId)) ?? false;
    return { userId, result, credits: await this.view(userId, steamLinked) };
  }

  /**
   * Grants the plan's monthly credits for the current credit period when the subscription is
   * entitled (idempotent per owner, plan and period start; leftovers of the previous period
   * expire). Stripe periods are anchored on current_period_end; admin plans use calendar months.
   */
  async syncPlanCredits(ownerId: string): Promise<"granted" | "skipped"> {
    const sub = await this.plans.subscription(ownerId);
    if (!this.plans.entitled(sub)) return "skipped";
    const plan = await this.plans.plan(sub.planId);
    const credits =
      plan?.active === false ? 0 : (plan?.limits.monthlyCredits ?? 0);
    if (!plan || credits <= 0) return "skipped";
    const anchor = sub.source === "stripe" ? sub.currentPeriodEnd : null;
    if (sub.source === "stripe" && !anchor) return "skipped";
    const now = this.clock.now();
    const period = creditPeriod(now, this.clock, anchor, sub.currentPeriodEnd);
    const result = await this.repository.credit(
      {
        ownerId,
        delta: credits,
        reason: "plan_grant",
        bucket: "plan",
        ref: `period:${plan.id}:${period.start}`,
        expiresAt: period.end,
      },
      now,
    );
    return result === "ok" ? "granted" : "skipped";
  }

  /** A paid credit pack (Stripe Checkout session id as the idempotency ref). */
  async purchase(
    ownerId: string,
    packId: string,
    credits: number,
    sessionId: string,
  ): Promise<CreditResult> {
    if (!(await this.plans.userExists(ownerId)) || credits <= 0)
      return "duplicate";
    return this.repository.credit(
      {
        ownerId,
        delta: credits,
        reason: "purchase",
        bucket: "purchased",
        ref: sessionId,
        note: `pack ${packId}`,
      },
      this.clock.now(),
    );
  }

  /** Ledger sums vs the wallet (consistency check for tests and admins). */
  async reconcile(
    ownerId: string,
  ): Promise<{ ledger: Buckets; wallet: Buckets; consistent: boolean }> {
    const [ledger, wallet] = await Promise.all([
      this.repository.ledgerTotals(ownerId),
      this.repository.wallet(ownerId, new Date(0)),
    ]);
    return {
      ledger,
      wallet: wallet.balances,
      consistent:
        ledger.plan === wallet.balances.plan &&
        ledger.bonus === wallet.balances.bonus &&
        ledger.purchased === wallet.balances.purchased,
    };
  }
}
