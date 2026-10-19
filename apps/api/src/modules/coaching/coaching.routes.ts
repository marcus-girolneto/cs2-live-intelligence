import type { FastifyInstance } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import type { CoachingController } from "./coaching.controller.js";
import type {
  CoachProfileRequestDto,
  LiveCallRequestDto,
} from "./coaching.dto.js";

export function registerCoachingRoutes(
  app: FastifyInstance,
  controller: CoachingController,
  guards: AuthGuards,
): void {
  const user = { preHandler: guards.requireUser };
  app.get("/v1/coach/profile", user, controller.profile);
  app.put<{ Body: CoachProfileRequestDto | null }>(
    "/v1/coach/profile",
    user,
    controller.updateProfile,
  );
  app.get("/v1/coach/progress", user, controller.progress);
  app.post<{ Params: { id: string } }>(
    "/v1/coach/reviews/:id/rating",
    user,
    controller.rate,
  );
  app.post<{ Body: LiveCallRequestDto | null }>(
    "/v1/ai/live-call",
    user,
    controller.liveCall,
  );
  app.post<{ Params: { id: string } }>(
    "/v1/analyses/:id/coaching",
    user,
    controller.review,
  );
}
