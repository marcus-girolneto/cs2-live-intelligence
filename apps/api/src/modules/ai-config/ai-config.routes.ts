import type { FastifyInstance } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import type { AiAdminController } from "./ai-admin.controller.js";
import type { AiStatusController } from "./ai-status.controller.js";

type ById = { Params: { id: string } };

/** Admin AI providers, assignments and app settings (database mode). */
export function registerAiAdminRoutes(
  app: FastifyInstance,
  admin: AiAdminController,
  guards: AuthGuards,
): void {
  const adminOnly = { preHandler: guards.requireAdmin };
  app.get("/v1/admin/ai/providers", adminOnly, admin.list);
  app.post("/v1/admin/ai/providers", adminOnly, admin.create);
  app.put<ById>("/v1/admin/ai/providers/:id", adminOnly, admin.update);
  app.delete<ById>("/v1/admin/ai/providers/:id", adminOnly, admin.remove);
  app.post<ById>("/v1/admin/ai/providers/:id/test", adminOnly, admin.test);
  app.get<ById>("/v1/admin/ai/providers/:id/models", adminOnly, admin.models);
  app.get("/v1/admin/ai/assignments", adminOnly, admin.assignments);
  app.put("/v1/admin/ai/assignments", adminOnly, admin.assign);
  app.get("/v1/admin/settings", adminOnly, admin.settings);
  app.put("/v1/admin/settings", adminOnly, admin.updateSettings);
}

/** AI status for every user and the admin connectivity test (with the jobs module). */
export function registerAiStatusRoutes(
  app: FastifyInstance,
  status: AiStatusController,
  guards: AuthGuards,
): void {
  app.get("/v1/ai/status", { preHandler: guards.requireUser }, status.status);
  app.post<{ Body: { purpose?: unknown } | null }>(
    "/v1/ai/test",
    { preHandler: guards.requireAdmin },
    status.test,
  );
}
