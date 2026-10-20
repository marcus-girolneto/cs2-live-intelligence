import type { FastifyInstance } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import type { ApiKeysController } from "./api-keys.controller.js";

/** Settings → Developers: the signed-in user's API keys (session auth, coded errors). */
export function registerApiKeysRoutes(
  app: FastifyInstance,
  controller: ApiKeysController,
  guards: AuthGuards,
): void {
  const user = { preHandler: guards.requireUser };
  app.get("/v1/me/api-keys", user, controller.list);
  app.post("/v1/me/api-keys", user, controller.create);
  app.delete<{ Params: { id: string } }>(
    "/v1/me/api-keys/:id",
    user,
    controller.revoke,
  );
}
