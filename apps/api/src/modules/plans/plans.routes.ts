import type { FastifyInstance } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import type { PlansController } from "./plans.controller.js";

/** Route table only. Plans answer guard failures with a `code` (coded guards). */
export function registerPlansRoutes(
  app: FastifyInstance,
  controller: PlansController,
  guards: AuthGuards,
): void {
  const admin = { preHandler: guards.requireAdmin };
  // The plan catalogue is public (prices and limits), so the signed-out landing can show it.
  app.get("/v1/plans", controller.list);
  app.get("/v1/admin/plans", admin, controller.adminList);
  app.put("/v1/admin/plans", admin, controller.adminUpdate);
  app.put<{ Params: { id: string } }>(
    "/v1/admin/plans/:id",
    admin,
    controller.adminUpdate,
  );
  app.put<{ Params: { id: string } }>(
    "/v1/admin/users/:id/plan",
    admin,
    controller.grant,
  );
}
