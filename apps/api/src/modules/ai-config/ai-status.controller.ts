import type { ConnectivityResult } from "../../infrastructure/ai/coaching-ai-gateway.js";
import { purposeOf, type AiPurpose } from "./ai-config.dto.js";
import type { FastifyRequest } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import { ownerOf } from "../../shared/http/principal.js";
import type { AiAccessService } from "./ai-access.service.js";

/** GET /v1/ai/status (any user) and POST /v1/ai/test (admin). */
export class AiStatusController {
  constructor(
    private readonly access: AiAccessService,
    private readonly guards: AuthGuards,
  ) {}

  status = async (request: FastifyRequest): Promise<Record<string, unknown>> =>
    this.access.status(await this.guards.isAdmin(ownerOf(request)));

  test = async (
    request: FastifyRequest<{ Body: { purpose?: unknown } | null }>,
  ): Promise<ConnectivityResult & { purpose: AiPurpose }> =>
    this.access.test(ownerOf(request), purposeOf(request.body?.purpose));
}
