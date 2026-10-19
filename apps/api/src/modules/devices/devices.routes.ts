import type { FastifyInstance } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import type { DevicesController } from "./devices.controller.js";

export function registerDevicesRoutes(
  app: FastifyInstance,
  controller: DevicesController,
  guards: AuthGuards,
): void {
  const user = { preHandler: guards.requireUser };
  app.get("/v1/devices", user, controller.list);
  app.post("/v1/devices/pair", user, controller.pair);
  app.post("/v1/devices/claim", controller.claim);
  app.post<{ Params: { id: string } }>(
    "/v1/devices/:id/rotate",
    user,
    controller.rotate,
  );
  app.delete<{ Params: { id: string } }>(
    "/v1/devices/:id",
    user,
    controller.revoke,
  );
}
