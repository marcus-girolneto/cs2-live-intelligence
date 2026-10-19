import { BillingDisabledError } from "../../shared/errors/index.js";
import type { PaymentEvent, PaymentGateway } from "./payment-gateway.js";

/** Null Object: billing is not configured; every operation answers 503 billing_disabled. */
export class NullPaymentGateway implements PaymentGateway {
  readonly name = "none";
  readonly enabled = false;
  createCheckout(): Promise<{ url: string }> {
    return Promise.reject(new BillingDisabledError());
  }
  createPortal(): Promise<{ url: string }> {
    return Promise.reject(new BillingDisabledError());
  }
  verifyWebhook(): PaymentEvent {
    throw new BillingDisabledError();
  }
}
