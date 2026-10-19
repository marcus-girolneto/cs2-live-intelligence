import type { FastifyInstance } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import type { MatchesController } from "./matches.controller.js";

export function registerMatchesRoutes(
  app: FastifyInstance,
  controller: MatchesController,
  guards: AuthGuards,
  maxUploadBytes: number,
): void {
  const user = { preHandler: guards.requireUser };
  app.addContentTypeParser("application/octet-stream", controller.parseUpload);
  app.post(
    "/v1/demos/uploads",
    {
      bodyLimit: maxUploadBytes,
      onRequest: controller.admitUpload,
      onResponse: controller.endUpload,
      onRequestAbort: controller.endUpload,
      onError: controller.failUpload,
    },
    controller.upload,
  );
  app.get("/v1/demos/sample", user, controller.sampleAvailability);
  app.post("/v1/demos/sample", user, controller.importSample);
  app.get("/v1/matches", user, controller.list);
  app.get<{ Params: { id: string } }>("/v1/matches/:id", user, controller.get);
  app.get(
    "/v1/admin/analyses/reprocess/status",
    { preHandler: guards.requireAdmin },
    controller.reprocessStatus,
  );
  app.post(
    "/v1/admin/analyses/reprocess",
    { preHandler: guards.requireAdmin },
    controller.reprocess,
  );
}
