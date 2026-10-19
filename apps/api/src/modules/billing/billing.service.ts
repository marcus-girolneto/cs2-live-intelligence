import {
  BillingDisabledError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors/index.js";
import type {
  PaymentEvent,
  PaymentGateway,
} from "../../infrastructure/billing/payment-gateway.js";
import { NullPaymentGateway } from "../../infrastructure/billing/null-payment-gateway.js";
import type { Currency, Interval } from "../plans/plans.dto.js";
import type {
  PlanRecord,
  SubscriptionRecord,
} from "../plans/plans.repository.js";
import type { CreditCheckoutRequest } from "../credits/credits.dto.js";
import type {
  BillingStatusDto,
  CheckoutRequestDto,
  RedirectDto,
  WebhookResultDto,
} from "./billing.dto.js";
import type { BillingRepository } from "./billing.repository.js";

/** What billing needs from plans/subscriptions. */
export interface BillingPlans {
  plan(id: string): Promise<PlanRecord | undefined>;
  adminPlans(): Promise<{ id: string; stripePrices: Record<string, string> }[]>;
  subscription(ownerId: string): Promise<SubscriptionRecord | undefined>;
  findSubscriptionByStripe(ref: {
    customerId?: string | null;
    subscriptionId?: string | null;
  }): Promise<SubscriptionRecord | undefined>;
  applyProviderState(state: {
    ownerId: string;
    planId: string;
    status: SubscriptionRecord["status"];
    source: "stripe";
    currentPeriodEnd: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
  }): Promise<void>;
}
/** Port (credits): packs on sale, paid pack grants and plan-period credit grants. */
export interface BillingCredits {
  pack(id: string): Promise<
    | {
        id: string;
        name: string;
        credits: number;
        prices: Partial<Record<Currency, number>>;
        stripePrices: Partial<Record<Currency, string>>;
        active: boolean;
      }
    | undefined
  >;
  purchase(
    ownerId: string,
    packId: string,
    credits: number,
    sessionId: string,
  ): Promise<unknown>;
  syncPlanCredits(ownerId: string): Promise<unknown>;
}
export type BillingConfig = {
  webOrigin: string;
  /** Payment method types per currency (e.g. BRL: ["card","pix"]). */
  paymentMethods: Record<Currency, string[]>;
  /** Env price ids: STRIPE_PRICE_<PLAN>_<MONTHLY|YEARLY>[_<CURRENCY>]. */
  env: Record<string, string | undefined>;
};

const NOT_FOUND = { code: "not_found" } as const;
const INVALID = { code: "invalid_request" } as const;
const str = (v: unknown): string | null =>
  typeof v === "string" && v ? v : null;
const id = (v: unknown): string | null =>
  str(v) ?? str((v as { id?: unknown } | null)?.id ?? null);
const STATUS: Record<string, SubscriptionRecord["status"]> = {
  active: "active",
  trialing: "trialing",
  past_due: "past_due",
  unpaid: "past_due",
  incomplete: "past_due",
  paused: "canceled",
  canceled: "canceled",
  incomplete_expired: "canceled",
};
const unix = (v: unknown): string | null =>
  typeof v === "number" && Number.isFinite(v) && v > 0
    ? new Date(v * 1000).toISOString()
    : null;

/** Subscriptions through an optional payment gateway. Without one, billing is disabled. */
export class BillingService {
  /** The configured gateway, or the Null Object when billing is disabled. */
  private readonly gateway: PaymentGateway;
  constructor(
    gateway: PaymentGateway | undefined,
    private readonly plans: BillingPlans,
    private readonly events: BillingRepository,
    private readonly config: BillingConfig,
    private readonly credits?: BillingCredits,
  ) {
    this.gateway = gateway ?? new NullPaymentGateway();
  }
  get enabled(): boolean {
    return this.gateway.enabled !== false;
  }
  status(): BillingStatusDto {
    if (!this.enabled) return { enabled: false };
    return {
      enabled: true,
      provider: this.gateway.name,
      currencies: ["BRL", "USD"],
      intervals: ["month", "year"],
      paymentMethods: this.config.paymentMethods,
    };
  }
  private gw(): PaymentGateway {
    if (!this.enabled) throw new BillingDisabledError();
    return this.gateway;
  }
  /** Price id from the plan row, else STRIPE_PRICE_<PLAN>_<MONTHLY|YEARLY>[_<CURRENCY>]. */
  priceId(
    plan: PlanRecord,
    interval: Interval,
    currency: Currency,
  ): string | null {
    const env = `STRIPE_PRICE_${plan.id.toUpperCase().replace(/-/g, "_")}_${interval === "month" ? "MONTHLY" : "YEARLY"}`;
    return (
      plan.stripePrices[`${currency}_${interval}`] ??
      this.config.env[`${env}_${currency}`] ??
      this.config.env[env] ??
      null
    );
  }
  async checkout(
    ownerId: string,
    request: CheckoutRequestDto,
  ): Promise<RedirectDto> {
    const gateway = this.gw();
    const plan = await this.plans.plan(request.planId);
    if (!plan || !plan.active || plan.id === "free")
      throw new NotFoundError("Plan not available for purchase", NOT_FOUND);
    const priceId = this.priceId(plan, request.interval, request.currency);
    if (!priceId)
      throw new ValidationError(
        "This plan has no price for the selected interval and currency.",
        INVALID,
      );
    const existing = await this.plans.subscription(ownerId);
    return gateway.createCheckout({
      priceId,
      ownerId,
      planId: plan.id,
      customerId: existing?.stripeCustomerId ?? null,
      paymentMethodTypes: this.config.paymentMethods[request.currency],
      successUrl: `${this.config.webOrigin}/billing?status=success`,
      cancelUrl: `${this.config.webOrigin}/billing?status=cancel`,
    });
  }
  /** POST /v1/billing/credits/checkout: one-time Checkout for a credit pack. */
  async creditCheckout(
    ownerId: string,
    request: CreditCheckoutRequest,
  ): Promise<RedirectDto> {
    const gateway = this.gw();
    const pack = await this.credits?.pack(request.packId);
    if (!pack || !pack.active)
      throw new NotFoundError("Credit pack not available", NOT_FOUND);
    const amount = pack.prices[request.currency];
    const priceId = pack.stripePrices[request.currency] ?? null;
    if (!priceId && !amount)
      throw new ValidationError(
        "This pack has no price in the selected currency.",
        INVALID,
      );
    const existing = await this.plans.subscription(ownerId);
    return gateway.createPaymentCheckout({
      ownerId,
      customerId: existing?.stripeCustomerId ?? null,
      priceId,
      currency: request.currency,
      amount: amount ?? 0,
      productName: `${pack.name} — ${pack.credits} credits`,
      metadata: {
        kind: "credits",
        packId: pack.id,
        ownerId,
        credits: String(pack.credits),
      },
      paymentMethodTypes: this.config.paymentMethods[request.currency],
      successUrl: `${this.config.webOrigin}/billing?credits=success`,
      cancelUrl: `${this.config.webOrigin}/billing?credits=cancel`,
    });
  }

  async portal(ownerId: string): Promise<RedirectDto> {
    const gateway = this.gw();
    const customer = (await this.plans.subscription(ownerId))?.stripeCustomerId;
    if (!customer) throw new NotFoundError("No billing account yet", NOT_FOUND);
    return gateway.createPortal(customer, `${this.config.webOrigin}/billing`);
  }

  /** Verifies and applies one webhook delivery; repeated event ids are acknowledged and skipped. */
  async webhook(
    rawBody: string,
    signature: string | undefined,
  ): Promise<WebhookResultDto> {
    const event = this.gw().verifyWebhook(rawBody, signature);
    if (await this.events.seen(event.id))
      return { received: true, duplicate: true };
    await this.apply(event);
    const fresh = await this.events.record(event.id, event.type);
    return { received: true, duplicate: !fresh };
  }

  private async planFromPrice(
    object: Record<string, unknown>,
  ): Promise<string | null> {
    const items = (object.items as { data?: unknown[] } | undefined)?.data;
    const price = id(
      (items?.[0] as { price?: unknown } | undefined)?.price ?? null,
    );
    if (!price) return null;
    for (const plan of await this.plans.adminPlans())
      if (Object.values(plan.stripePrices).includes(price)) return plan.id;
    for (const [key, value] of Object.entries(this.config.env))
      if (value === price) {
        const m =
          /^STRIPE_PRICE_([A-Z0-9_]+?)_(MONTHLY|YEARLY)(_[A-Z]{3})?$/.exec(key);
        if (m) return m[1]!.toLowerCase().replace(/_/g, "-");
      }
    return null;
  }

  /** A paid one-time Checkout for a credit pack (async methods: when the payment succeeds). */
  private async creditPurchase(
    o: Record<string, unknown>,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    if (metadata.kind !== "credits" || o.payment_status !== "paid") return;
    const ownerId = str(metadata.ownerId) ?? str(o.client_reference_id);
    const packId = str(metadata.packId);
    const sessionId = id(o.id);
    if (!ownerId || !packId || !sessionId || !this.credits) return;
    // Credits as sold at checkout time (the pack may have been edited since).
    const sold = Number(str(metadata.credits));
    const credits =
      Number.isInteger(sold) && sold > 0
        ? sold
        : ((await this.credits.pack(packId))?.credits ?? 0);
    await this.credits.purchase(ownerId, packId, credits, sessionId);
  }

  private async apply(event: PaymentEvent): Promise<void> {
    const o = event.object;
    const metadata = (o.metadata ?? {}) as Record<string, unknown>;
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        if (o.mode === "payment") return this.creditPurchase(o, metadata);
        if (
          o.mode !== "subscription" ||
          event.type !== "checkout.session.completed"
        )
          return;
        const ownerId = str(o.client_reference_id) ?? str(metadata.ownerId);
        const planId = str(metadata.planId);
        if (!ownerId || !planId) return;
        const known = await this.plans.subscription(ownerId);
        await this.plans.applyProviderState({
          ownerId,
          planId,
          status: "active",
          source: "stripe",
          // Keep a period end already reported by subscription/invoice events.
          currentPeriodEnd:
            known?.stripeSubscriptionId === id(o.subscription)
              ? known.currentPeriodEnd
              : null,
          stripeCustomerId: id(o.customer),
          stripeSubscriptionId: id(o.subscription),
        });
        await this.credits?.syncPlanCredits(ownerId);
        return;
      }
      case "invoice.paid": {
        const parent = o.parent as
          { subscription_details?: { subscription?: unknown } } | undefined;
        const subscriptionId =
          id(o.subscription) ?? id(parent?.subscription_details?.subscription);
        const known = await this.plans.findSubscriptionByStripe({
          subscriptionId,
          customerId: id(o.customer),
        });
        if (!known || known.source !== "stripe") return;
        const line = (o.lines as { data?: { period?: { end?: unknown } }[] })
          ?.data?.[0];
        await this.plans.applyProviderState({
          ownerId: known.ownerId,
          planId: known.planId,
          status: "active",
          source: "stripe",
          currentPeriodEnd: unix(line?.period?.end) ?? known.currentPeriodEnd,
          stripeCustomerId: known.stripeCustomerId,
          stripeSubscriptionId: known.stripeSubscriptionId,
        });
        await this.credits?.syncPlanCredits(known.ownerId);
        return;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscriptionId = id(o.id);
        const customerId = id(o.customer);
        const known = await this.plans.findSubscriptionByStripe({
          subscriptionId,
          customerId,
        });
        const ownerId = str(metadata.ownerId) ?? known?.ownerId ?? null;
        if (!ownerId) return;
        const planId =
          str(metadata.planId) ??
          (await this.planFromPrice(o)) ??
          known?.planId;
        if (!planId) return;
        const items = (o.items as { data?: { current_period_end?: unknown }[] })
          ?.data;
        await this.plans.applyProviderState({
          ownerId,
          planId,
          status:
            event.type === "customer.subscription.deleted"
              ? "canceled"
              : (STATUS[str(o.status) ?? ""] ?? "past_due"),
          source: "stripe",
          currentPeriodEnd:
            unix(o.current_period_end) ?? unix(items?.[0]?.current_period_end),
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
        });
        await this.credits?.syncPlanCredits(ownerId);
        return;
      }
      case "invoice.payment_failed": {
        const parent = o.parent as
          { subscription_details?: { subscription?: unknown } } | undefined;
        const subscriptionId =
          id(o.subscription) ?? id(parent?.subscription_details?.subscription);
        const known = await this.plans.findSubscriptionByStripe({
          subscriptionId,
          customerId: id(o.customer),
        });
        if (!known || known.source !== "stripe") return;
        await this.plans.applyProviderState({
          ownerId: known.ownerId,
          planId: known.planId,
          status: "past_due",
          source: "stripe",
          currentPeriodEnd: known.currentPeriodEnd,
          stripeCustomerId: known.stripeCustomerId,
          stripeSubscriptionId: known.stripeSubscriptionId,
        });
        return;
      }
    }
  }
}
