import type { PaymentGateway } from "./payment-gateway.js";
import { NullPaymentGateway } from "./null-payment-gateway.js";
import { StripePaymentGateway } from "./stripe-payment-gateway.js";

/**
 * Factory: Stripe when STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are both set, otherwise the
 * Null Object. `override` (tests) wins: a gateway is used as is, null disables billing.
 */
export function createPaymentGateway(
  env: Record<string, string | undefined>,
  override?: PaymentGateway | null,
  fetchImpl: typeof fetch = fetch,
): PaymentGateway {
  if (override !== undefined) return override ?? new NullPaymentGateway();
  const key = env.STRIPE_SECRET_KEY?.trim();
  const webhook = env.STRIPE_WEBHOOK_SECRET?.trim();
  return key && webhook
    ? new StripePaymentGateway(key, webhook, fetchImpl)
    : new NullPaymentGateway();
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
