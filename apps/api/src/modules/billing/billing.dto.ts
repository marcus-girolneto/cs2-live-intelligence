import { z } from "zod";
import { CURRENCIES, INTERVALS } from "../plans/plans.dto.js";

export const checkoutRequestSchema = z
  .object({
    planId: z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/),
    interval: z.enum(INTERVALS),
    currency: z.enum(CURRENCIES),
  })
  .strict();
export type CheckoutRequestDto = z.infer<typeof checkoutRequestSchema>;
export type BillingStatusDto =
  | { enabled: false }
  | {
      enabled: true;
      provider: string;
      currencies: string[];
      intervals: string[];
      paymentMethods: Record<string, string[]>;
      /** Stripe publishable key, when an admin configured one. */
      publishableKey?: string;
    };
export type RedirectDto = { url: string };
/** POST /v1/billing/webhook response. */
export type WebhookResultDto = { received: true; duplicate: boolean };
