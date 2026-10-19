import type { FastifyInstance } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import type { ReportsController } from "./reports.controller.js";

/** Route table only (coded guards: errors always carry a `code`). */
export function registerReportsRoutes(
  app: FastifyInstance,
  controller: ReportsController,
  guards: AuthGuards,
): void {
  const user = { preHandler: guards.requireUser };
  app.get("/v1/reports", user, controller.list);
  app.get<{ Params: { id: string } }>("/v1/reports/:id", user, controller.get);
  app.post<{ Body: { lang?: unknown } | null }>(
    "/v1/reports/generate",
    user,
    controller.generate,
  );
}
