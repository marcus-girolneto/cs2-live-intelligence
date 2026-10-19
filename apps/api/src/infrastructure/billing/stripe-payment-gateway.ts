import { createHmac, timingSafeEqual } from "node:crypto";
import { UpstreamError, ValidationError } from "../../shared/errors/index.js";
import type {
  CheckoutRequest,
  PaymentCheckoutRequest,
  PaymentEvent,
  PaymentGateway,
} from "./payment-gateway.js";

const API = "https://api.stripe.com/v1";
const INVALID = { code: "invalid_request" } as const;
export const WEBHOOK_TOLERANCE_SECONDS = 300;

/** Flattens nested params to Stripe's form encoding (a[b][0]=c). */
export function formEncode(
  params: Record<string, unknown>,
  prefix = "",
  out = new URLSearchParams(),
): URLSearchParams {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value))
      value.forEach((v, i) =>
        typeof v === "object" && v !== null
          ? formEncode(v as Record<string, unknown>, `${name}[${i}]`, out)
          : out.append(`${name}[${i}]`, String(v)),
      );
    else if (typeof value === "object")
      formEncode(value as Record<string, unknown>, name, out);
    else out.append(name, String(value));
  }
  return out;
}

/** Stripe-Signature check: `t=<unix>,v1=<hex hmac-sha256 of "t.body">`, timing-safe, ±tolerance. */
export function verifyStripeSignature(
  rawBody: string,
  header: string | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  tolerance = WEBHOOK_TOLERANCE_SECONDS,
): void {
  if (!header) throw new ValidationError("Missing webhook signature", INVALID);
  const parts = header.split(",").map((p) => p.trim().split("="));
  const timestamp = Number(parts.find(([k]) => k === "t")?.[1]);
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v ?? "");
  if (!Number.isInteger(timestamp) || !signatures.length)
    throw new ValidationError("Malformed webhook signature", INVALID);
  if (Math.abs(nowSeconds - timestamp) > tolerance)
    throw new ValidationError(
      "Webhook signature timestamp outside tolerance",
      INVALID,
    );
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest();
  const ok = signatures.some((s) => {
    if (!/^[a-f0-9]{64}$/.test(s)) return false;
    const given = Buffer.from(s, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!ok) throw new ValidationError("Invalid webhook signature", INVALID);
}

/** Builds a valid Stripe-Signature header (tests and local tooling). */
export function signStripePayload(
  rawBody: string,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000),
): string {
  const v1 = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

/** Stripe REST adapter (form-encoded fetch, no SDK). Never sends or logs card data. */
export class StripePaymentGateway implements PaymentGateway {
  readonly name = "stripe";
  constructor(
    private readonly secretKey: string,
    private readonly webhookSecret: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}
  private async post(
    path: string,
    params: Record<string, unknown>,
  ): Promise<{ url: string }> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${API}${path}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.secretKey}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: formEncode(params).toString(),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new UpstreamError("The payment provider could not be reached.");
    }
    const body = (await response.json().catch(() => ({}))) as {
      url?: unknown;
      error?: { message?: unknown };
    };
    if (!response.ok || typeof body.url !== "string")
      throw new UpstreamError(
        `The payment provider rejected the request${
          typeof body.error?.message === "string"
            ? `: ${body.error.message.replaceAll(this.secretKey, "[redacted]").slice(0, 200)}`
            : "."
        }`,
      );
    return { url: body.url };
  }
  createCheckout(r: CheckoutRequest): Promise<{ url: string }> {
    return this.post("/checkout/sessions", {
      mode: "subscription",
      line_items: [{ price: r.priceId, quantity: 1 }],
      payment_method_types: r.paymentMethodTypes,
      client_reference_id: r.ownerId,
      ...(r.customerId ? { customer: r.customerId } : {}),
      success_url: r.successUrl,
      cancel_url: r.cancelUrl,
      metadata: { ownerId: r.ownerId, planId: r.planId },
      subscription_data: { metadata: { ownerId: r.ownerId, planId: r.planId } },
    });
  }
  createPaymentCheckout(r: PaymentCheckoutRequest): Promise<{ url: string }> {
    return this.post("/checkout/sessions", {
      mode: "payment",
      line_items: [
        r.priceId
          ? { price: r.priceId, quantity: 1 }
          : {
              price_data: {
                currency: r.currency.toLowerCase(),
                unit_amount: r.amount,
                product_data: { name: r.productName },
              },
              quantity: 1,
            },
      ],
      payment_method_types: r.paymentMethodTypes,
      client_reference_id: r.ownerId,
      ...(r.customerId ? { customer: r.customerId } : {}),
      success_url: r.successUrl,
      cancel_url: r.cancelUrl,
      metadata: r.metadata,
      payment_intent_data: { metadata: r.metadata },
    });
  }
  createPortal(
    customerId: string,
    returnUrl: string,
  ): Promise<{ url: string }> {
    return this.post("/billing_portal/sessions", {
      customer: customerId,
      return_url: returnUrl,
    });
  }
  verifyWebhook(rawBody: string, header: string | undefined): PaymentEvent {
    verifyStripeSignature(
      rawBody,
      header,
      this.webhookSecret,
      Math.floor(this.now() / 1000),
    );
    let event: { id?: unknown; type?: unknown; data?: { object?: unknown } };
    try {
      event = JSON.parse(rawBody) as typeof event;
    } catch {
      throw new ValidationError("Invalid webhook payload", INVALID);
    }
    if (
      typeof event.id !== "string" ||
      typeof event.type !== "string" ||
      typeof event.data?.object !== "object" ||
      event.data.object === null
    )
      throw new ValidationError("Invalid webhook payload", INVALID);
    return {
      id: event.id,
      type: event.type,
      object: event.data.object as Record<string, unknown>,
    };
  }
}
