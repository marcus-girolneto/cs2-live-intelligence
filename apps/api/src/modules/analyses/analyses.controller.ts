import type { FastifyRequest } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import { ownerOf } from "../../shared/http/principal.js";
import { ViewerPolicy } from "../coaching/viewer.policy.js";
import type { StoredAnalysis } from "../matches/matches.dto.js";
import type { AnalysesService } from "./analyses.service.js";

export class AnalysesController {
  constructor(
    private readonly analyses: AnalysesService,
    private readonly guards: AuthGuards,
  ) {}

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
