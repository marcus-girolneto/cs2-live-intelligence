import type { FastifyInstance } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import type {
  ByName,
  IntegrationsController,
} from "./integrations.controller.js";

/** Admin integrations: credentials are write-only; changes apply without a restart. */
export function registerIntegrationsRoutes(
  app: FastifyInstance,
  controller: IntegrationsController,
  guards: AuthGuards,
): void {
  const adminOnly = { preHandler: guards.requireAdmin };
  app.get("/v1/admin/integrations", adminOnly, controller.view);
  app.put("/v1/admin/integrations/steam", adminOnly, controller.updateSteam);
  app.put("/v1/admin/integrations/stripe", adminOnly, controller.updateStripe);
  app.post<ByName>(
    "/v1/admin/integrations/:name/test",
    adminOnly,
    controller.test,
  );
}
