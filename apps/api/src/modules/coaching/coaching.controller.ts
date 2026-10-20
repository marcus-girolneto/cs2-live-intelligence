import type { CoachProfileDto } from "./coaching.dto.js";
import type { FastifyRequest } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import { ownerOf } from "../../shared/http/principal.js";
import { parseDto } from "../../shared/http/validation.js";
import type { CoachProfileService } from "./coach-profile.service.js";
import {
  autoReviewPatchSchema,
  coachPlayerIdSchema,
  langSchema,
  playerQuerySchema,
  progressQuerySchema,
  ratingRequestSchema,
  reviewRequestSchema,
  type CoachProfileRequestDto,
  type LiveCallRequestDto,
} from "./coaching.dto.js";
import type { LiveCallService } from "./live-call.service.js";
import type { ProgressService } from "./progress.service.js";
import type { ReelService } from "./reel.service.js";
import type { ReviewService } from "./review.service.js";
import { ViewerPolicy } from "./viewer.policy.js";

type ById = FastifyRequest<{ Params: { id: string } }>;

/** Coach profile, progress, AI reviews (+ ratings) and live calls. */
export class CoachingController {
  constructor(
    private readonly profiles: CoachProfileService,
    private readonly progressService: ProgressService,
    private readonly reviews: ReviewService,
    private readonly liveCalls: LiveCallService,
    private readonly guards: AuthGuards,
    private readonly reels: ReelService,
  ) {}

  private async viewer(ownerId: string): Promise<ViewerPolicy> {
    return ViewerPolicy.for(await this.guards.isAdmin(ownerId));
  }

  profile = async (request: FastifyRequest): Promise<CoachProfileDto> =>
    this.profiles.get(ownerOf(request));

  updateProfile = async (
    request: FastifyRequest<{ Body: CoachProfileRequestDto | null }>,
  ): Promise<CoachProfileDto> => {
    const ownerId = ownerOf(request);
    const playerSteamId = parseDto(
      coachPlayerIdSchema,
      request.body?.playerSteamId,
      "playerSteamId must be a player id from your demos.",
    );
    const autoReview = parseDto(
      autoReviewPatchSchema,
      request.body?.autoReview ?? undefined,
      "autoReview must be {enabled?: boolean, tier?: quick|deep, lang?: en|pt|es|ru|zh|de|fr|pl|tr}.",
    );
    return this.profiles.update(
      ownerId,
      request.body?.preferences,
      playerSteamId,
      autoReview,
    );
  };

  progress = async (
    request: FastifyRequest,
  ): Promise<Record<string, unknown>> => {
    const ownerId = ownerOf(request);
    const query = parseDto(
      progressQuerySchema,
      request.query ?? {},
      "Invalid map",
    );
    return this.progressService.progress(
      ownerId,
      await this.viewer(ownerId),
      query.map,
    );
  };

  rate = async (request: ById): Promise<{ ok: true }> => {
    const ownerId = ownerOf(request);
    const body = parseDto(
      ratingRequestSchema,
      request.body,
      "Rating must be 1 to 5.",
    );
    return this.reviews.rate(ownerId, request.params.id, body.rating);
  };

  review = async (request: ById): Promise<Record<string, unknown>> => {
    const ownerId = ownerOf(request);
    const body = parseDto(
      reviewRequestSchema,
      request.body ?? {},
      "Invalid player",
    );
    return this.reviews.review(
      ownerId,
      request.params.id,
      body.steamId,
      body.lang,
      await this.viewer(ownerId),
      body.tier,
    );
  };

  /** GET /v1/analyses/:id/reviews?steamId= (saved quick/deep reviews, no cost). */
  matchReviews = async (request: ById): Promise<Record<string, unknown>> => {
    const ownerId = ownerOf(request);
    const query = parseDto(
      playerQuerySchema,
      request.query ?? {},
      "Invalid player",
    );
    return this.reviews.matchReviews(
      ownerId,
      request.params.id,
      query.steamId,
      await this.viewer(ownerId),
    );
  };

  /** GET /v1/analyses/:id/reel?steamId= (Pro). */
  reel = async (request: ById): Promise<Record<string, unknown>> => {
    const query = parseDto(
      playerQuerySchema,
      request.query ?? {},
      "Invalid player",
    );
    return this.reels.reel(ownerOf(request), request.params.id, query.steamId);
  };

  liveCall = async (
    request: FastifyRequest<{ Body: LiveCallRequestDto | null }>,
  ): Promise<Record<string, unknown>> => {
    const ownerId = ownerOf(request);
    const body = request.body ?? {};
    return this.liveCalls.call(
      ownerId,
      body,
      langSchema.parse(body.lang),
      await this.viewer(ownerId),
    );
  };
}
