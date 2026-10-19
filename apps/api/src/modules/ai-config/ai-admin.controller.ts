import type { ConnectivityResult } from "../../infrastructure/ai/coaching-ai-gateway.js";
import type { ModelListing } from "../../infrastructure/ai/model-catalog.js";
import type {
  AssignmentMap,
  AssignmentMapView,
  ProviderViewDto,
} from "./ai-config.dto.js";
import type { AppSettingsViewDto } from "./app-settings.service.js";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ownerOf } from "../../shared/http/principal.js";
import { describeIssues, parseDto } from "../../shared/http/validation.js";
import {
  appSettingsSchema,
  assignmentsSchema,
  createProviderSchema,
  providerTestSchema,
  purposeOf,
  purposeTestSchema,
  type AiPurpose,
  updateProviderSchema,
} from "./ai-config.dto.js";
import type { AiProviderAdminService } from "./ai-provider-admin.service.js";
import type { AppSettingsService } from "./app-settings.service.js";

type ById = FastifyRequest<{ Params: { id: string } }>;
/** Port (AiAccessService): a purpose's real connectivity check with its resolved config. */
export interface PurposeTester {
  test(
    adminId: string,
    purpose: AiPurpose,
  ): Promise<ConnectivityResult & { purpose: AiPurpose }>;
}

/** Admin-only AI providers, purpose assignments and app settings. */
export class AiAdminController {
  constructor(
    private readonly providers: AiProviderAdminService,
    private readonly appSettings: AppSettingsService,
    private readonly purposes: PurposeTester,
  ) {}

  /** POST /v1/admin/ai/test {purpose, providerId?, model?}. */
  testPurpose = async (
    request: FastifyRequest,
  ): Promise<ConnectivityResult & { purpose: AiPurpose }> => {
    const body = parseDto(
      purposeTestSchema,
      request.body,
      (e) => `Invalid test request: ${describeIssues(e)}`,
    );
    const purpose = purposeOf(body.purpose);
    if (!body.providerId && !body.model)
      return this.purposes.test(ownerOf(request), purpose);
    return {
      ...(await this.providers.testFor(
        ownerOf(request),
        purpose,
        body.providerId,
        body.model,
      )),
      purpose,
    };
  };

  list = async (): Promise<{
    providers: ProviderViewDto[];
    assignments: AssignmentMap;
  }> => this.providers.list();

  create = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply> => {
    const body = parseDto(
      createProviderSchema,
      request.body,
      (e) => `Invalid provider: ${describeIssues(e)}`,
    );
    return reply
      .code(201)
      .send(await this.providers.create(ownerOf(request), body));
  };

  update = async (request: ById): Promise<ProviderViewDto> => {
    const body = parseDto(
      updateProviderSchema,
      request.body,
      (e) => `Invalid provider: ${describeIssues(e)}`,
    );
    return this.providers.update(ownerOf(request), request.params.id, body);
  };

  remove = async (
    request: ById,
    reply: FastifyReply,
  ): Promise<FastifyReply> => {
    await this.providers.remove(ownerOf(request), request.params.id);
    return reply.code(204).send();
  };

  test = async (request: ById): Promise<ConnectivityResult> => {
    const body = parseDto(
      providerTestSchema,
      request.body,
      "Invalid test request",
    );
    return this.providers.test(
      ownerOf(request),
      request.params.id,
      body?.model,
    );
  };

  models = async (request: ById): Promise<ModelListing> =>
    this.providers.models(request.params.id);

  assignments = async (): Promise<{ assignments: AssignmentMapView }> =>
    this.providers.assignments();

  assign = async (
    request: FastifyRequest,
  ): Promise<{ assignments: AssignmentMapView }> => {
    const body = parseDto(
      assignmentsSchema,
      request.body,
      (e) => `Invalid assignments: ${describeIssues(e)}`,
    );
    return this.providers.assign(ownerOf(request), body);
  };

  settings = async (): Promise<AppSettingsViewDto> => this.appSettings.view();

  updateSettings = async (
    request: FastifyRequest,
  ): Promise<AppSettingsViewDto> => {
    const patch = parseDto(
      appSettingsSchema.partial().strict(),
      request.body,
      (e) => `Invalid settings: ${describeIssues(e)}`,
    );
    return this.appSettings.update(ownerOf(request), patch);
  };
}
