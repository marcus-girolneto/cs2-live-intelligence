import type { PaymentGateway } from "./payment-gateway.js";
import { NullPaymentGateway } from "./null-payment-gateway.js";
import { StripePaymentGateway } from "./stripe-payment-gateway.js";

/** Port: where the payment gateway in effect comes from (resolved per operation). */
export interface PaymentGatewaySource {
  current(): Promise<PaymentGateway>;
}
/** Stripe credentials in effect (admin-managed, env bootstrap fallback). */
export interface StripeCredentials {
  secretKey: string | undefined;
  webhookSecret: string | undefined;
  /** Admin switch AND both secrets present. */
  active: boolean;
}

/** A fixed gateway (tests, overrides). */
export class StaticPaymentGatewaySource implements PaymentGatewaySource {
  constructor(private readonly gateway: PaymentGateway) {}
  async current(): Promise<PaymentGateway> {
    return this.gateway;
  }
}

/**
 * Factory + Strategy selection at call time: Stripe while the credentials in effect are
 * active, otherwise the Null Object. The Stripe adapter is rebuilt only when a key changes, so
 * admin edits (and the enable switch) apply to the next request without a restart.
 */
export class ConfiguredPaymentGatewaySource implements PaymentGatewaySource {
  private cached?: { fingerprint: string; gateway: PaymentGateway };
  private readonly disabled = new NullPaymentGateway();
  constructor(
    private readonly credentials: () => Promise<StripeCredentials>,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}
  async current(): Promise<PaymentGateway> {
    const c = await this.credentials();
    if (!c.active || !c.secretKey || !c.webhookSecret) return this.disabled;
    const fingerprint = `${c.secretKey}\u0000${c.webhookSecret}`;
    if (this.cached?.fingerprint !== fingerprint)
      this.cached = {
        fingerprint,
        gateway: new StripePaymentGateway(
          c.secretKey,
          c.webhookSecret,
          this.fetchImpl,
          this.now,
        ),
      };
    return this.cached.gateway;
  }
}

/**
 * Gateway source for the app. `override` (tests) wins: a gateway is used as is, null disables
 * billing; otherwise the credentials are read per call.
 */
export function createPaymentGatewaySource(
  credentials: () => Promise<StripeCredentials>,
  override?: PaymentGateway | null,
  fetchImpl: typeof fetch = fetch,
): PaymentGatewaySource {
  if (override !== undefined)
    return new StaticPaymentGatewaySource(override ?? new NullPaymentGateway());
  return new ConfiguredPaymentGatewaySource(credentials, fetchImpl);
}

/** Payment method types per currency from STRIPE_PAYMENT_METHODS_<CUR> (default card). */
export function paymentMethodsFromEnv(
  value: string | undefined,
  fallback: string[] = ["card"],
): string[] {
  const list = (value ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter((m) => /^[a-z_]{2,40}$/.test(m));
  return list.length ? list : fallback;
}
