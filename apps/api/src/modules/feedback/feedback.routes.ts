import type { FastifyInstance } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import type { FeedbackController } from "./feedback.controller.js";

export function registerFeedbackRoutes(
  app: FastifyInstance,
  controller: FeedbackController,
  guards: AuthGuards,
): void {
  const user = { preHandler: guards.requireUser };
  app.post("/v1/feedback", user, controller.submit);
  app.post("/v1/events", user, controller.track);
}
