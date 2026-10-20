import { randomUUID } from "node:crypto";
import type { SecretCipher } from "../../infrastructure/secrets/aes-gcm-secret-cipher.js";
import { base62 } from "../../shared/crypto/base62.js";
import { ConflictError, NotFoundError } from "../../shared/errors/index.js";
import { checkWebhookUrl, type UrlPolicy } from "./url-guard.js";
import { secretContext, type WebhookDeliverer } from "./webhook-deliverer.js";
import {
  MAX_WEBHOOKS,
  type CreateWebhookRequest,
  type CreatedWebhookDto,
  type DeliveryDto,
  type TestDeliveryDto,
  type WebhookDto,
} from "./webhooks.dto.js";
import type { WebhooksRepository } from "./webhooks.repository.js";

/** Port: the key audit trail (webhook lifecycle is recorded next to key events). */
export interface WebhookAudit {
  event(
    ownerId: string,
    keyId: string | null,
    action: string,
    details?: Record<string, unknown>,
  ): Promise<void>;
}

const notFound = (): NotFoundError =>
  new NotFoundError("Webhook not found", { code: "not_found" });

/** Webhook endpoints of an account: register (secret shown once), list, delete, test. */
export class WebhooksService {
  constructor(
    private readonly repository: WebhooksRepository,
    private readonly cipher: SecretCipher,
    private readonly deliverer: WebhookDeliverer,
    private readonly policy: UrlPolicy,
    private readonly audit: WebhookAudit,
  ) {}

  list(ownerId: string): Promise<WebhookDto[]> {
    return this.repository.list(ownerId);
  }

  async create(
    ownerId: string,
    request: CreateWebhookRequest,
  ): Promise<CreatedWebhookDto> {
    const url = checkWebhookUrl(request.url, this.policy).toString();
    const id = randomUUID();
    const secret = `whsec_${base62(32)}`;
    const created = await this.repository.create(
      ownerId,
      {
        id,
        url,
        events: request.events,
        secretCiphertext: this.cipher.encrypt(secret, secretContext(id)),
      },
      MAX_WEBHOOKS,
    );
    if (!created)
      throw new ConflictError(
        `You can register up to ${MAX_WEBHOOKS} webhooks. Delete one first.`,
        { code: "webhook_limit" },
      );
    await this.audit.event(ownerId, null, "webhook.created", {
      webhookId: id,
      events: request.events,
    });
    return { ...created, secret };
  }

  async remove(ownerId: string, id: string): Promise<{ deleted: true }> {
    if (!(await this.repository.remove(ownerId, id))) throw notFound();
    await this.audit.event(ownerId, null, "webhook.deleted", { webhookId: id });
    return { deleted: true };
  }

  async deliveries(
    ownerId: string,
    webhookId: string | undefined,
    limit: number,
  ): Promise<{ deliveries: DeliveryDto[] }> {
    if (webhookId && !(await this.repository.find(ownerId, webhookId)))
      throw notFound();
    return {
      deliveries: await this.repository.deliveries(ownerId, webhookId, limit),
    };
  }

  /** Sends a signed `ping` right away (no retries) and reports the receiver's answer. */
  async test(ownerId: string, id: string): Promise<TestDeliveryDto> {
    const webhook = await this.repository.find(ownerId, id);
    if (!webhook) throw notFound();
    const ping = await this.repository.createPing(webhook.id, ownerId);
    return this.deliverer.deliver(ping, false);
  }
}
