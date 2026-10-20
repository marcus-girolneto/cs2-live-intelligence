import type { FastifyInstance } from "fastify";
import type { ApiScope } from "../api-keys/api-keys.dto.js";
import type { WebhooksController } from "../webhooks/webhooks.controller.js";
import type { PublicAccountController } from "./public-account.controller.js";
import type { PublicDemosController } from "./public-demos.controller.js";
import type { PublicApiGate } from "./public-api.gate.js";

export const PUBLIC_PREFIX = "/api/v1";
/** A registered /api/v1 route (OpenAPI path syntax), for the documentation check. */
export type PublicRoute = { method: string; path: string; scope?: ApiScope };

export type PublicApiControllers = {
  gate: PublicApiGate;
  demos: PublicDemosController;
  account: PublicAccountController;
  webhooks: WebhooksController;
  openApi: () => Record<string, unknown>;
  maxUploadBytes: number;
};

type Id = { Params: { id: string } };
const scoped = (scope: ApiScope) => ({ config: { scope } });

/**
 * The public, versioned API: its own encapsulated Fastify scope with the API key gate, CORS,
 * its error format and its octet-stream parser. Only these routes exist under /api/v1; admin
 * and internal routes are never registered here.
 */
export async function registerPublicApi(
  app: FastifyInstance,
  c: PublicApiControllers,
  registered: PublicRoute[],
): Promise<void> {
  await app.register(
    async (api) => {
      api.addHook("onRoute", (route) => {
        const methods = [route.method].flat();
        for (const method of methods)
          if (method !== "OPTIONS" && method !== "HEAD")
            registered.push({
              method,
              path: route.url.replace(/:([A-Za-z]+)/g, "{$1}"),
              ...(route.config?.scope ? { scope: route.config.scope } : {}),
            });
      });
      api.setErrorHandler(c.gate.errorHandler);
      api.setNotFoundHandler(c.gate.notFound);
      api.addHook("onRequest", c.gate.onRequest);
      api.removeContentTypeParser("application/octet-stream");
      api.addContentTypeParser("application/octet-stream", c.demos.parseUpload);
      api.options("/*", c.gate.preflight);
      api.get("/openapi.json", async () => c.openApi());

      api.post(
        "/demos",
        {
          ...scoped("matches:write"),
          bodyLimit: c.maxUploadBytes,
          onRequest: c.demos.admitUpload,
          onResponse: c.demos.endUpload,
          onRequestAbort: c.demos.abortUpload,
          onError: c.demos.failUpload,
        },
        c.demos.upload,
      );
      api.get("/demos", scoped("matches:read"), c.demos.list);
      api.get<Id>("/demos/:id", scoped("matches:read"), c.demos.get);
      api.delete<Id>("/demos/:id", scoped("matches:write"), c.demos.remove);
      api.get<Id>(
        "/demos/:id/analysis",
        scoped("analyses:read"),
        c.demos.analysis,
      );
      api.get<{ Params: { id: string; steamId: string } }>(
        "/demos/:id/players/:steamId",
        scoped("analyses:read"),
        c.demos.player,
      );
      api.post<Id>(
        "/demos/:id/reviews",
        scoped("reviews:write"),
        c.account.createReview,
      );
      api.get<Id>(
        "/demos/:id/reviews",
        scoped("analyses:read"),
        c.account.demoReviews,
      );
      api.get<Id>("/reviews/:id", scoped("analyses:read"), c.account.review);
      api.get("/progress", scoped("progress:read"), c.account.progress);
      api.get("/me", scoped("account:read"), c.account.me);
      api.get("/credits/ledger", scoped("account:read"), c.account.ledger);

      const hooks = scoped("webhooks:manage");
      api.get("/webhooks", hooks, c.webhooks.list);
      api.post("/webhooks", hooks, c.webhooks.create);
      api.get("/webhooks/deliveries", hooks, c.webhooks.deliveries);
      api.delete<Id>("/webhooks/:id", hooks, c.webhooks.remove);
      api.post<Id>("/webhooks/:id/test", hooks, c.webhooks.test);
    },
    { prefix: PUBLIC_PREFIX },
  );
}
