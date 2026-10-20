import type { FastifyInstance } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import type { TrainingController } from "./training.controller.js";

export function registerTrainingRoutes(
  app: FastifyInstance,
  controller: TrainingController,
  guards: AuthGuards,
): void {
  const user = { preHandler: guards.requireUser };
  app.get("/v1/training/catalog", user, controller.catalog);
  app.get("/v1/training/recommended", user, controller.recommended);
  app.get<{ Params: { id: string } }>(
    "/v1/analyses/:id/training",
    user,
    controller.forAnalysis,
  );
}
