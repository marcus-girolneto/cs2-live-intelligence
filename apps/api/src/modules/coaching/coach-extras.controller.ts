import type { FastifyRequest } from "fastify";
import { ownerOf } from "../../shared/http/principal.js";
import { describeIssues, parseDto } from "../../shared/http/validation.js";
import {
  identityRequestSchema,
  idsQuerySchema,
  ownershipRequestSchema,
} from "./coaching.dto.js";
import type {
  OwnershipItemDto,
  OwnershipService,
} from "./ownership.service.js";

type ById = FastifyRequest<{ Params: { id: string } }>;

/** Match ownership and the tracked identity ("this is me"). */
export class CoachExtrasController {
  constructor(private readonly ownership: OwnershipService) {}

  /** GET /v1/matches/ownership?ids=a,b */
  ownershipList = async (
    request: FastifyRequest,
  ): Promise<{ items: OwnershipItemDto[] }> => {
    const query = parseDto(
      idsQuerySchema,
      request.query ?? {},
      "ids must be up to 100 comma-separated match ids.",
    );
    return this.ownership.list(ownerOf(request), query.ids);
  };

  /** PATCH /v1/matches/:id/ownership {ownership, playerSteamId?} */
  ownershipOverride = async (request: ById): Promise<OwnershipItemDto> => {
    const body = parseDto(
      ownershipRequestSchema,
      request.body,
      (e) => `Invalid ownership: ${describeIssues(e)}`,
    );
    return this.ownership.override(
      ownerOf(request),
      request.params.id,
      body.ownership,
      body.playerSteamId,
    );
  };

  /** PUT /v1/coach/identity {steamId, analysisIds?: string[] | "all"} */
  identity = async (
    request: FastifyRequest,
  ): Promise<{ steamId: string; updated: number; matches: number }> => {
    const body = parseDto(
      identityRequestSchema,
      request.body,
      (e) => `Invalid identity: ${describeIssues(e)}`,
    );
    return this.ownership.setIdentity(
      ownerOf(request),
      body.steamId,
      body.analysisIds,
    );
  };
}
