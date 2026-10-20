import type { FastifyReply, FastifyRequest } from "fastify";
import { ownerOf } from "../../shared/http/principal.js";
import { describeIssues, parseDto } from "../../shared/http/validation.js";
import {
  createWebhookSchema,
  deliveriesQuerySchema,
  type CreatedWebhookDto,
  type DeliveryDto,
  type TestDeliveryDto,
  type WebhookDto,
} from "./webhooks.dto.js";
import type { WebhooksService } from "./webhooks.service.js";

type ById = FastifyRequest<{ Params: { id: string } }>;
const INVALID = { code: "invalid_request" } as const;

/**
 * Webhook management. Used by the session routes (/v1/me/webhooks, Settings → Developers) and
 * by the public API (/api/v1/webhooks); both guards set `request.principal`.
 */
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  list = async (
    request: FastifyRequest,
  ): Promise<{ webhooks: WebhookDto[] }> => ({
    webhooks: await this.webhooks.list(ownerOf(request)),
  });

  create = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<CreatedWebhookDto> => {
    const body = parseDto(
      createWebhookSchema,
      request.body,
      (e) => `Invalid webhook: ${describeIssues(e, 3)}`,
      INVALID,
    );
    reply.code(201).header("cache-control", "no-store");
    return this.webhooks.create(ownerOf(request), body);
  };

  remove = async (request: ById): Promise<{ deleted: true }> =>
    this.webhooks.remove(ownerOf(request), request.params.id);

  test = async (request: ById): Promise<TestDeliveryDto> =>
    this.webhooks.test(ownerOf(request), request.params.id);

  deliveries = async (
    request: FastifyRequest,
  ): Promise<{ deliveries: DeliveryDto[] }> => {
    const query = parseDto(
      deliveriesQuerySchema,
      request.query ?? {},
      "webhookId must be a webhook id and limit 1 to 100",
      INVALID,
    );
    return this.webhooks.deliveries(
      ownerOf(request),
      query.webhookId,
      query.limit,
    );
  };
}
