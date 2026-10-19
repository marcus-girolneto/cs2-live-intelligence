import type { FastifyInstance } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import type { CreditsController } from "./credits.controller.js";

/** Route table only. Credit routes answer guard failures with a `code` (coded guards). */
export function registerCreditsRoutes(
  app: FastifyInstance,
  controller: CreditsController,
  guards: AuthGuards,
): void {
  const user = { preHandler: guards.requireUser };
  const admin = { preHandler: guards.requireAdmin };
  app.get("/v1/credits/ledger", user, controller.ledger);
  // The pack catalogue is public (prices), like the plan catalogue.
  app.get("/v1/credits/packs", controller.packs);
  app.get("/v1/admin/credits/settings", admin, controller.adminSettings);
  app.put("/v1/admin/credits/settings", admin, controller.updateSettings);
  app.get("/v1/admin/credits/packs", admin, controller.adminPacks);
  app.put("/v1/admin/credits/packs", admin, controller.updatePacks);
  app.get<{ Params: { id: string } }>(
    "/v1/admin/users/:id/ledger",
    admin,
    controller.userLedger,
  );
  app.post<{ Params: { id: string } }>(
    "/v1/admin/users/:id/credits",
    admin,
    controller.adjust,
  );
}
