import type { FastifyRequest } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import { ownerOf } from "../../shared/http/principal.js";
import { NotFoundError } from "../../shared/errors/index.js";
import { ViewerPolicy } from "../coaching/viewer.policy.js";
import type { StoredAnalysis } from "../matches/matches.dto.js";
import type { AnalysesService } from "./analyses.service.js";
import type {
  IntegrityDto,
  IntegrityService,
} from "../integrity/integrity.service.js";

export class AnalysesController {
  constructor(
    private readonly analyses: AnalysesService,
    private readonly guards: AuthGuards,
    private readonly integrityService?: IntegrityService,
  ) {}

  /** GET /v1/analyses/:id/integrity (uploader only). */
  integrity = async (
    request: FastifyRequest<{ Params: { id: string } }>,
  ): Promise<IntegrityDto> => {
    if (!this.integrityService) throw new NotFoundError("Not found");
    return this.integrityService.view(ownerOf(request), request.params.id);
  };

  get = async (
    request: FastifyRequest<{ Params: { id: string } }>,
  ): Promise<StoredAnalysis> => {
    const ownerId = ownerOf(request);
    return this.analyses.get(
      ownerId,
      request.params.id,
      ViewerPolicy.for(await this.guards.isAdmin(ownerId)),
    );
  };
}
