import type { FastifyInstance } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import type { CoachExtrasController } from "./coach-extras.controller.js";

/** Ownership/identity, team reviews, lobby comparison and auto-review status. */
export function registerCoachExtrasRoutes(
  app: FastifyInstance,
  controller: CoachExtrasController,
  guards: AuthGuards,
): void {
  const user = { preHandler: guards.requireUser };
  app.get("/v1/matches/ownership", user, controller.ownershipList);
  app.patch<{ Params: { id: string } }>(
    "/v1/matches/:id/ownership",
    user,
    controller.ownershipOverride,
  );
  app.put("/v1/coach/identity", user, controller.identity);
  app.post<{ Params: { id: string } }>(
    "/v1/analyses/:id/team-review",
    user,
    controller.teamReview,
  );
  app.get<{ Params: { id: string } }>(
    "/v1/analyses/:id/team-reviews",
    user,
    controller.teamReviews,
  );
  app.get<{ Params: { id: string } }>(
    "/v1/analyses/:id/lobby",
    user,
    controller.lobby,
  );
}
