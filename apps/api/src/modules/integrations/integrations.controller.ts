import type { FastifyRequest } from "fastify";
import { ownerOf } from "../../shared/http/principal.js";
import { describeIssues, parseDto } from "../../shared/http/validation.js";
import { NotFoundError } from "../../shared/errors/index.js";
import {
  integrationNameSchema,
  steamUpdateSchema,
  stripeUpdateSchema,
  type IntegrationTestDto,
  type IntegrationsViewDto,
} from "./integrations.dto.js";
import type { IntegrationsService } from "./integrations.service.js";

export type ByName = { Params: { name: string } };

/** Admin-only third-party integrations (Steam Web API, Stripe). */
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  view = async (): Promise<IntegrationsViewDto> => this.integrations.view();

  updateSteam = async (
    request: FastifyRequest,
  ): Promise<IntegrationsViewDto> => {
    const body = parseDto(
      steamUpdateSchema,
      request.body,
      (e) => `Invalid Steam settings: ${describeIssues(e)}`,
      { code: "invalid_request" },
    );
    return this.integrations.updateSteam(ownerOf(request), body);
  };

  updateStripe = async (
    request: FastifyRequest,
  ): Promise<IntegrationsViewDto> => {
    const body = parseDto(
      stripeUpdateSchema,
      request.body ?? {},
      (e) => `Invalid Stripe settings: ${describeIssues(e)}`,
      { code: "invalid_request" },
    );
    return this.integrations.updateStripe(ownerOf(request), body);
  };

  test = async (
    request: FastifyRequest<ByName>,
  ): Promise<IntegrationTestDto> => {
    const name = integrationNameSchema.safeParse(request.params.name);
    if (!name.success)
      throw new NotFoundError("Unknown integration", { code: "not_found" });
    return this.integrations.test(ownerOf(request), name.data);
  };
}
