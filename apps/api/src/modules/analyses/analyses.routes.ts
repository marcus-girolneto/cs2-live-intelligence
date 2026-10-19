import type { FastifyInstance } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import type { AnalysesController } from "./analyses.controller.js";

export function registerAnalysesRoutes(
  app: FastifyInstance,
  controller: AnalysesController,
  guards: AuthGuards,
): void {
  app.get<{ Params: { id: string } }>(
    "/v1/analyses/:id",
    { preHandler: guards.requireUser },
    controller.get,
  );
  app.get<{ Params: { id: string } }>(
    "/v1/analyses/:id/integrity",
    { preHandler: guards.requireUser },
    controller.integrity,
  );
}
