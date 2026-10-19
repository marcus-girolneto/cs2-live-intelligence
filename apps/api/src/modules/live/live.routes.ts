import type { FastifyInstance } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import type { LiveSocketQuery } from "./live.dto.js";
import type { LiveController } from "./live.controller.js";

export function registerLiveRoutes(
  app: FastifyInstance,
  controller: LiveController,
  guards: AuthGuards,
): void {
  const user = { preHandler: guards.requireUser };
  app.get("/v1/live/sessions", user, controller.sessions);
  app.get<{ Params: { id: string } }>(
    "/v1/live/sessions/:id",
    user,
    controller.session,
  );
  app.post("/v1/live/tickets", user, controller.ticket);
  app.get<{ Querystring: LiveSocketQuery }>(
    "/v1/live",
    { websocket: true, preValidation: controller.admit },
    controller.connect,
  );
}
