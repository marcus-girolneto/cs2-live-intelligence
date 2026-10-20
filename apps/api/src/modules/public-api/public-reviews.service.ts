import { NotFoundError } from "../../shared/errors/index.js";
import type {
  SavedReview,
  ReviewLookup,
} from "../coaching/review-lookup.repository.js";
import type { PublicReviewRequest } from "./public-api.dto.js";

/** Port (coaching): player and team reviews, exactly as the web app requests them. */
export interface ReviewRunner {
  player(
    ownerId: string,
    demoId: string,
    steamId: string,
    lang: PublicReviewRequest["lang"],
    tier: "quick" | "deep",
  ): Promise<Record<string, unknown>>;
  team(
    ownerId: string,
    demoId: string,
    steamId: string,
    lang: PublicReviewRequest["lang"],
  ): Promise<Record<string, unknown>>;
}
/** Removes model identity from a stored review (API callers are never admins). */
type Redact = (payload: unknown) => unknown;

/** AI reviews on /api/v1: request one (spends credits like the web app), list, read one. */
export class PublicReviewsService {
  constructor(
    private readonly runner: ReviewRunner,
    private readonly lookup: ReviewLookup,
    private readonly demoExists: (
      ownerId: string,
      id: string,
    ) => Promise<boolean>,
    private readonly redact: Redact,
    private readonly baseUrl: string,
  ) {}

  private view(review: SavedReview): Record<string, unknown> {
    return {
      id: review.id,
      demoId: review.demoId,
      steamId: review.steamId,
      tier: review.tier,
      lang: review.lang,
      createdAt: review.createdAt,
      creditsSpent: review.creditsSpent,
      rating: review.rating,
      review: this.redact(review.payload),
      links: {
        self: `${this.baseUrl}/api/v1/reviews/${review.id}`,
        demo: `${this.baseUrl}/api/v1/demos/${review.demoId}`,
      },
    };
  }

  /** Runs the review synchronously (it can take a minute) and returns the saved review. */
  async create(
    ownerId: string,
    demoId: string,
    request: PublicReviewRequest,
  ): Promise<Record<string, unknown>> {
    const result =
      request.tier === "team"
        ? await this.runner.team(ownerId, demoId, request.steamId, request.lang)
        : await this.runner.player(
            ownerId,
            demoId,
            request.steamId,
            request.lang,
            request.tier,
          );
    const saved = await this.lookup.byId(ownerId, String(result.reviewId));
    if (!saved)
      throw new NotFoundError("Review not found", { code: "not_found" });
    return { ...this.view(saved), balance: result.balance };
  }

  async list(
    ownerId: string,
    demoId: string,
    steamId?: string,
  ): Promise<{ data: Record<string, unknown>[] }> {
    if (!(await this.demoExists(ownerId, demoId)))
      throw new NotFoundError("Demo not found", { code: "not_found" });
    const reviews = await this.lookup.forDemo(ownerId, demoId, steamId);
    return { data: reviews.map((r) => this.view(r)) };
  }

  async get(ownerId: string, id: string): Promise<Record<string, unknown>> {
    const review = await this.lookup.byId(ownerId, id);
    if (!review)
      throw new NotFoundError("Review not found", { code: "not_found" });
    return this.view(review);
  }
}
