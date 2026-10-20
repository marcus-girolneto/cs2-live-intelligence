import type { FastifyReply, FastifyRequest } from "fastify";
import { UnauthorizedError } from "../../shared/errors/index.js";
import { ownerOf } from "../../shared/http/principal.js";
import { describeIssues, parseDto } from "../../shared/http/validation.js";
import {
  ledgerQuerySchema,
  progressQuerySchema,
  reviewRequestSchema,
  reviewsQuerySchema,
} from "./public-api.dto.js";
import type { PublicAccountService } from "./public-account.service.js";
import type { PublicReviewsService } from "./public-reviews.service.js";

type ById = FastifyRequest<{ Params: { id: string } }>;
const INVALID = { code: "invalid_request" } as const;

/** /api/v1 reviews, account, credits and progress. */
export class PublicAccountController {
  constructor(
    private readonly reviews: PublicReviewsService,
    private readonly account: PublicAccountService,
  ) {}

  createReview = async (
    request: ById,
    reply: FastifyReply,
  ): Promise<unknown> => {
    const body = parseDto(
      reviewRequestSchema,
      request.body ?? {},
      (e) => `Invalid review request: ${describeIssues(e, 3)}`,
      INVALID,
    );
    reply.code(201);
    return this.reviews.create(ownerOf(request), request.params.id, body);
  };

  demoReviews = async (request: ById): Promise<unknown> => {
    const query = parseDto(
      reviewsQuerySchema,
      request.query ?? {},
      "steamId must be a player id",
      INVALID,
    );
    return this.reviews.list(
      ownerOf(request),
      request.params.id,
      query.steamId,
    );
  };

  review = async (request: ById): Promise<unknown> =>
    this.reviews.get(ownerOf(request), request.params.id);

  me = async (request: FastifyRequest): Promise<unknown> => {
    if (!request.apiKey) throw new UnauthorizedError();
    return this.account.me(ownerOf(request), request.apiKey);
  };

  ledger = async (request: FastifyRequest): Promise<unknown> =>
    this.account.ledger(
      ownerOf(request),
      parseDto(
        ledgerQuerySchema,
        request.query ?? {},
        "limit must be 1 to 200",
        INVALID,
      ).limit,
    );

  progress = async (request: FastifyRequest): Promise<unknown> =>
    this.account.progress(
      ownerOf(request),
      parseDto(progressQuerySchema, request.query ?? {}, "Invalid map", INVALID)
        .map,
    );
}
