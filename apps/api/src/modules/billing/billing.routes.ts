import type { FastifyInstance } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import type { BillingController } from "./billing.controller.js";

/** Route table only. The webhook lives in its own scope with a raw-string JSON parser. */
export async function registerBillingRoutes(
  app: FastifyInstance,
  controller: BillingController,
  guards: AuthGuards,
): Promise<void> {
  const user = { preHandler: guards.requireUser };
  app.get("/v1/billing/status", user, controller.status);
  app.post("/v1/billing/checkout", user, controller.checkout);
  app.post("/v1/billing/portal", user, controller.portal);
  app.post("/v1/billing/credits/checkout", user, controller.creditCheckout);
  await app.register(async (scope) => {
    scope.removeContentTypeParser("application/json");
    scope.addContentTypeParser(
      "application/json",
      { parseAs: "string", bodyLimit: 512 * 1024 },
      (_request, body, done) => done(null, body),
    );
    scope.post("/v1/billing/webhook", controller.webhook);
  });
}
