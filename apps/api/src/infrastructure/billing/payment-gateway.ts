/** Payment provider port (Adapter + Strategy). Stripe and the Null Object implement it; tests use fakes. */
export type CheckoutRequest = {
  priceId: string;
  ownerId: string;
  planId: string;
  customerId: string | null;
  paymentMethodTypes: string[];
  successUrl: string;
  cancelUrl: string;
};
/** Provider-neutral webhook event (only the fields the billing service reads). */
export type PaymentEvent = {
  id: string;
  type: string;
  object: Record<string, unknown>;
};
export interface PaymentGateway {
  readonly name: string;
  /** False only for the Null Object (billing not configured). */
  readonly enabled?: boolean;
  createCheckout(request: CheckoutRequest): Promise<{ url: string }>;
  createPortal(customerId: string, returnUrl: string): Promise<{ url: string }>;
  /** Verifies the signature over the exact raw body; throws on any mismatch. */
  verifyWebhook(
    rawBody: string,
    signatureHeader: string | undefined,
  ): PaymentEvent;
}
