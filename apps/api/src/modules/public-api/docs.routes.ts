import type { FastifyInstance, FastifyReply } from "fastify";
import {
  DOCS_CSP,
  DOCS_HTML,
  type SwaggerAssets,
} from "../../infrastructure/docs/swagger-assets.js";

const secure = (reply: FastifyReply): FastifyReply =>
  reply
    .header("content-security-policy", DOCS_CSP)
    .header("x-content-type-options", "nosniff")
    .header("x-frame-options", "DENY")
    .header("referrer-policy", "no-referrer");

/** GET /api/docs: Swagger UI for /api/v1 (self-hosted assets, strict same-origin CSP). */
export function registerDocsRoutes(
  app: FastifyInstance,
  assets: SwaggerAssets,
): void {
  app.get("/api/docs", async (_request, reply) =>
    secure(reply)
      .header("cache-control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(DOCS_HTML),
  );
  app.get<{ Params: { asset: string } }>(
    "/api/docs/:asset",
    async (request, reply) => {
      const asset = assets.get(request.params.asset);
      if (!asset) return reply.code(404).send({ error: "Not found" });
      return secure(reply)
        .header("cache-control", "public, max-age=3600")
        .type(asset.type)
        .send(asset.body);
    },
  );
}
