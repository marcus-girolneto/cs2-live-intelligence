import type { FastifyInstance } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import type { AdminController } from "./admin.controller.js";

export function registerAdminRoutes(
  app: FastifyInstance,
  controller: AdminController,
  guards: AuthGuards,
): void {
  const adminOnly = { preHandler: guards.requireAdmin };
  app.get("/v1/admin/users", adminOnly, controller.users);
  app.put<{ Params: { id: string } }>(
    "/v1/admin/users/:id/role",
    adminOnly,
    controller.changeRole,
  );
  app.get<{ Querystring: { limit?: string } }>(
    "/v1/admin/audit",
    adminOnly,
    controller.audit,
  );
}
