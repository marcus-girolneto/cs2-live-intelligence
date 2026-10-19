import type { FastifyInstance } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import type { UsersController } from "./users.controller.js";

export function registerUsersRoutes(
  app: FastifyInstance,
  controller: UsersController,
  guards: AuthGuards,
): void {
  app.get("/v1/me", { preHandler: guards.requireUser }, controller.me);
  app.post(
    "/v1/me/refresh-profile",
    { preHandler: guards.requireUser },
    controller.refreshProfile,
  );
}
