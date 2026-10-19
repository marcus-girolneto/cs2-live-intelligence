import type { FastifyRequest } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import { ownerOf } from "../../shared/http/principal.js";
import { langSchema } from "../coaching/coaching.dto.js";
import { ViewerPolicy } from "../coaching/viewer.policy.js";
import type {
  PersonalCoachService,
  PersonalCoachView,
} from "./personal-coach.service.js";

/** GET /v1/coach/personal and POST /v1/coach/personal/generate. */
export class PersonalCoachController {
  constructor(
    private readonly coach: PersonalCoachService,
    private readonly guards: AuthGuards,
  ) {}

  private async viewer(ownerId: string): Promise<ViewerPolicy> {
    return ViewerPolicy.for(await this.guards.isAdmin(ownerId));
  }

  get = async (request: FastifyRequest): Promise<PersonalCoachView> => {
    const ownerId = ownerOf(request);
    return this.coach.view(ownerId, await this.viewer(ownerId));
  };

  generate = async (
    request: FastifyRequest<{ Body: { lang?: unknown } | null }>,
  ): Promise<PersonalCoachView> => {
    const ownerId = ownerOf(request);
    return this.coach.generate(
      ownerId,
      langSchema.parse(request.body?.lang),
      await this.viewer(ownerId),
    );
  };
}
