import type {
  BillingStatusDto,
  RedirectDto,
  WebhookResultDto,
} from "./billing.dto.js";
import type { FastifyRequest } from "fastify";
import { ownerOf } from "../../shared/http/principal.js";
import { parseDto } from "../../shared/http/validation.js";
import { checkoutRequestSchema } from "./billing.dto.js";
import type { BillingService } from "./billing.service.js";

export class BillingController {
  constructor(private readonly billing: BillingService) {}

  status = async (): Promise<BillingStatusDto> => this.billing.status();

  checkout = async (request: FastifyRequest): Promise<RedirectDto> => {
    const body = parseDto(
      checkoutRequestSchema,
      request.body,
      "Body must be {planId, interval: month|year, currency: BRL|USD}",
      { code: "invalid_request" },
    );
    return this.billing.checkout(ownerOf(request), body);
  };

  portal = async (request: FastifyRequest): Promise<RedirectDto> =>
    this.billing.portal(ownerOf(request));

  /** Raw body (string) is required for signature verification. */
  webhook = async (request: FastifyRequest): Promise<WebhookResultDto> => {
    const raw = typeof request.body === "string" ? request.body : "";
    const signature = request.headers["stripe-signature"];
    return this.billing.webhook(
      raw,
      typeof signature === "string" ? signature : undefined,
    );
  };
}
