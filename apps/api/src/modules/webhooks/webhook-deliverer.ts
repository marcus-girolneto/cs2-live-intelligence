import type { WebhookTransport } from "../../infrastructure/http/webhook-transport.js";
import type { SecretCipher } from "../../infrastructure/secrets/aes-gcm-secret-cipher.js";
import { checkWebhookUrl, type UrlPolicy } from "./url-guard.js";
import { signatureHeader, SIGNATURE_HEADER } from "./webhook-signer.js";
import { MAX_ATTEMPTS, type TestDeliveryDto } from "./webhooks.dto.js";
import type { DueDelivery, WebhooksRepository } from "./webhooks.repository.js";

/** Context of the secret ciphertext: binds a secret to its webhook. */
export const secretContext = (webhookId: string): string =>
  `webhook:${webhookId}:secret`;

/** Delay before retry `attempt` (1-based): 30 s doubling, at most 6 hours. */
export function backoffMs(attempt: number): number {
  return Math.min(30_000 * 2 ** Math.max(0, attempt - 1), 6 * 3_600_000);
}

/**
 * Signs and sends one delivery and records the outcome (retry with exponential backoff, final
 * failure after MAX_ATTEMPTS, webhook auto-disable handled by the repository).
 */
export class WebhookDeliverer {
  constructor(
    private readonly repository: WebhooksRepository,
    private readonly cipher: SecretCipher,
    private readonly transport: WebhookTransport,
    private readonly policy: UrlPolicy,
    private readonly apiBaseUrl: string,
    private readonly now: () => number = Date.now,
  ) {}

  /** The JSON body: `{id, type, createdAt, data}` (data links point at /api/v1). */
  body(delivery: DueDelivery): string {
    const data = { ...delivery.payload };
    const links: Record<string, string> = {};
    if (typeof data.demoId === "string") {
      links.demo = `${this.apiBaseUrl}/api/v1/demos/${data.demoId}`;
      if (delivery.event === "demo.completed")
        links.analysis = `${links.demo}/analysis`;
    }
    if (typeof data.reviewId === "string")
      links.review = `${this.apiBaseUrl}/api/v1/reviews/${data.reviewId}`;
    return JSON.stringify({
      id: delivery.id,
      type: delivery.event,
      createdAt: delivery.createdAt,
      data: Object.keys(links).length ? { ...data, links } : data,
    });
  }

  async deliver(
    delivery: DueDelivery,
    retries = true,
  ): Promise<TestDeliveryDto> {
    let status: number | null = null;
    let error: string | null;
    try {
      checkWebhookUrl(delivery.url, this.policy);
      const secret = this.cipher.decrypt(
        delivery.secretCiphertext,
        secretContext(delivery.webhookId),
      );
      const body = this.body(delivery);
      const timestamp = Math.floor(this.now() / 1000);
      ({ status, error } = await this.transport.post(delivery.url, body, {
        [SIGNATURE_HEADER]: signatureHeader(secret, timestamp, body),
        "FragMind-Event": delivery.event,
        "FragMind-Delivery": delivery.id,
      }));
    } catch (e) {
      error = e instanceof Error ? e.message.slice(0, 200) : "Delivery failed";
    }
    const ok = error === null;
    const last = !retries || delivery.attempts >= MAX_ATTEMPTS;
    await this.repository.recordAttempt(delivery, {
      ok,
      status,
      error,
      retryAt: last
        ? null
        : new Date(this.now() + backoffMs(delivery.attempts)),
      countFailure: retries,
    });
    return { delivered: ok, status, error };
  }
}
