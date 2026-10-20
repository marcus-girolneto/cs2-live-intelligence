import type { FastifyInstance } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import type { WebhooksController } from "./webhooks.controller.js";

/** Settings → Developers: the signed-in user's webhooks (session auth, coded errors). */
export function registerWebhookSessionRoutes(
  app: FastifyInstance,
  controller: WebhooksController,
  guards: AuthGuards,
): void {
  const user = { preHandler: guards.requireUser };
  app.get("/v1/me/webhooks", user, controller.list);
  app.post("/v1/me/webhooks", user, controller.create);
  app.get("/v1/me/webhooks/deliveries", user, controller.deliveries);
  app.delete<{ Params: { id: string } }>(
    "/v1/me/webhooks/:id",
    user,
    controller.remove,
  );
  app.post<{ Params: { id: string } }>(
    "/v1/me/webhooks/:id/test",
    user,
    controller.test,
  );
}
