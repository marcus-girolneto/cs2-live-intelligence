import type { FastifyInstance } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import type { PrivacyController } from "./privacy.controller.js";

export function registerPrivacyRoutes(
  app: FastifyInstance,
  controller: PrivacyController,
  guards: AuthGuards,
): void {
  const user = { preHandler: guards.requireUser };
  app.get("/v1/settings", user, controller.settings);
  app.put("/v1/settings", user, controller.update);
  app.delete("/v1/account", user, controller.deleteAccount);
}
