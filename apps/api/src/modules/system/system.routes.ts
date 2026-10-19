import type { FastifyInstance } from "fastify";
import type { AppMetrics } from "../../shared/logging/metrics.js";
import { openApiDocument } from "./openapi/document.js";

/** Port: database readiness (absent in the in-memory mode). */
export interface ReadinessProbe {
  ready(): Promise<void>;
}

/** Health, readiness, Prometheus counters and the OpenAPI document (all public). */
export function registerSystemRoutes(
  app: FastifyInstance,
  metrics: AppMetrics,
  probe: ReadinessProbe | undefined,
): void {
  app.get("/metrics", async (_request, reply) => {
    reply.type("text/plain; version=0.0.4");
    return metrics.render();
  });
  app.get("/health", async () => ({
    status: "ok",
    storage: probe ? "postgres" : "memory",
  }));
  app.get("/ready", async (_request, reply) => {
    try {
      await probe?.ready();
      return { status: "ready" };
    } catch {
      return reply.code(503).send({ status: "unavailable" });
    }
  });
  app.get("/openapi.json", async () => openApiDocument());
}
