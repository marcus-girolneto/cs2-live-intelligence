import type { FastifyRequest } from "fastify";
import { ownerOf } from "../../shared/http/principal.js";
import { describeIssues, parseDto } from "../../shared/http/validation.js";
import type { AuthGuards } from "../../shared/http/guards.js";
import {
  identityRequestSchema,
  idsQuerySchema,
  ownershipRequestSchema,
  playerQuerySchema,
  teamReviewRequestSchema,
} from "./coaching.dto.js";
import type { TeamReviewService } from "./team-review.service.js";
import type {
  AutoReviewService,
  AutoReviewStatusDto,
} from "./auto-review.service.js";
import { ViewerPolicy } from "./viewer.policy.js";
import type {
  OwnershipItemDto,
  OwnershipService,
} from "./ownership.service.js";

type ById = FastifyRequest<{ Params: { id: string } }>;

/** Match ownership, the tracked identity ("this is me"), team reviews and the lobby view. */
export class CoachExtrasController {
  constructor(
    private readonly ownership: OwnershipService,
    private readonly teams: TeamReviewService,
    private readonly guards: AuthGuards,
    private readonly autoReviews: AutoReviewService,
  ) {}

  /** GET /v1/matches/auto-reviews?ids=a,b */
  autoReviewStatuses = async (
    request: FastifyRequest,
  ): Promise<{ items: AutoReviewStatusDto[] }> => {
    const query = parseDto(
      idsQuerySchema,
      request.query ?? {},
      "ids must be up to 100 comma-separated match ids.",
    );
    return this.autoReviews.statuses(ownerOf(request), query.ids);
  };

  private async viewer(ownerId: string): Promise<ViewerPolicy> {
    return ViewerPolicy.for(await this.guards.isAdmin(ownerId));
  }

  /** POST /v1/analyses/:id/team-review {steamId, lang?} */
  teamReview = async (request: ById): Promise<Record<string, unknown>> => {
    const ownerId = ownerOf(request);
    const body = parseDto(
      teamReviewRequestSchema,
      request.body ?? {},
      "Invalid player",
    );
    return this.teams.review(
      ownerId,
      request.params.id,
      body.steamId,
      body.lang,
      await this.viewer(ownerId),
    );
  };

  /** GET /v1/analyses/:id/team-reviews?steamId= */
  teamReviews = async (request: ById): Promise<Record<string, unknown>> => {
    const ownerId = ownerOf(request);
    const query = parseDto(
      playerQuerySchema,
      request.query ?? {},
      "Invalid player",
    );
    return this.teams.list(
      ownerId,
      request.params.id,
      query.steamId,
      await this.viewer(ownerId),
    );
  };

  /** GET /v1/analyses/:id/lobby?steamId= */
  lobby = async (request: ById): Promise<Record<string, unknown>> => {
    const query = parseDto(
      playerQuerySchema,
      request.query ?? {},
      "Invalid player",
    );
    return this.teams.lobby(ownerOf(request), request.params.id, query.steamId);
  };

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
