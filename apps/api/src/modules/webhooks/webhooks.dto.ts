import { z } from "zod";

export const WEBHOOK_EVENTS = [
  "demo.completed",
  "demo.failed",
  "review.completed",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
/** Sent only by the "test delivery" button / endpoint. */
export type DeliveryEvent = WebhookEvent | "ping";

export const MAX_WEBHOOKS = 5;
/** Delivery attempts per event before it is marked failed. */
export const MAX_ATTEMPTS = 8;
/** Consecutive failed attempts (any event) after which a webhook is disabled. */
export const DISABLE_AFTER_FAILURES = 20;

/** POST /api/v1/webhooks and POST /v1/me/webhooks. */
export const createWebhookSchema = z
  .object({
    url: z.string().trim().min(8).max(2048),
    events: z
      .array(z.enum(WEBHOOK_EVENTS))
      .min(1)
      .max(WEBHOOK_EVENTS.length)
      .transform((events) => [...new Set(events)]),
  })
  .strict();
/** GET /api/v1/webhooks/deliveries and /v1/me/webhooks/deliveries. */
export const deliveriesQuerySchema = z.object({
  webhookId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type CreateWebhookRequest = z.infer<typeof createWebhookSchema>;

export type WebhookDto = {
  id: string;
  url: string;
  events: WebhookEvent[];
  active: boolean;
  consecutiveFailures: number;
  disabledReason: string | null;
  createdAt: string;
};
/** Creation response: the signing secret is returned this once. */
export type CreatedWebhookDto = WebhookDto & { secret: string };
export type DeliveryDto = {
  id: string;
  webhookId: string;
  event: DeliveryEvent;
  status: "pending" | "delivered" | "failed";
  attempts: number;
  lastStatus: number | null;
  lastError: string | null;
  nextAttemptAt: string | null;
  createdAt: string;
  deliveredAt: string | null;
};
export type TestDeliveryDto = {
  delivered: boolean;
  status: number | null;
  error: string | null;
};
