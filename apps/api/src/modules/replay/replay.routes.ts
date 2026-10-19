import type { FastifyInstance } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import type { ReplayController } from "./replay.controller.js";

/** Route table only; behaviour lives in the controller and service. */
export function registerReplayRoutes(
  app: FastifyInstance,
  controller: ReplayController,
  guards: AuthGuards,
): void {
  const user = { preHandler: guards.requireUser };
  app.get("/v1/analyses/:id/replay/meta", user, controller.meta);
  app.get("/v1/analyses/:id/replay", user, controller.window);
}
