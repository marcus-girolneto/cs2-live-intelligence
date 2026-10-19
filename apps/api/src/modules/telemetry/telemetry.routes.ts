import type { FastifyInstance } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import type { TelemetryController } from "./telemetry.controller.js";

export function registerTelemetryRoutes(
  app: FastifyInstance,
  controller: TelemetryController,
  guards: AuthGuards,
): void {
  app.post(
    "/v1/telemetry/gsi",
    { preHandler: guards.requireDevice },
    controller.ingest,
  );
}
