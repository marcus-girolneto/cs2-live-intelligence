import type { FastifyInstance } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import { FixedWindowRateLimiter } from "../../shared/http/rate-limit.js";
import type { AuthController } from "./auth.controller.js";

/**
 * Per-IP limit on credential endpoints (/v1/auth/*, /v1/devices/claim): 30 per minute,
 * at most 10 000 tracked addresses.
 */
export function installAuthRateLimit(app: FastifyInstance): void {
  const limiter = new FixedWindowRateLimiter({
    limit: 30,
    windowMs: 60000,
    capacity: 10000,
    now: Date.now,
  });
  app.addHook("onRequest", async (request, reply) => {
    if (
      !request.url.startsWith("/v1/auth/") &&
      !request.url.startsWith("/v1/devices/claim")
    )
      return;
    limiter.prune();
    const decision = limiter.hit(request.ip);
    if (decision === "capacity")
      return reply.code(429).send({ error: "Authentication capacity reached" });
    if (decision === "limited")
      return reply.code(429).send({ error: "Authentication rate limited" });
  });
}

export function registerAuthRoutes(
  app: FastifyInstance,
  controller: AuthController,
  guards: AuthGuards,
): void {
  app.post(
    "/v1/auth/logout",
    { preHandler: guards.requireUser },
    controller.logout,
  );
  app.get("/v1/auth/steam/start", controller.start);
  app.get<{ Querystring: Record<string, string> }>(
    "/v1/auth/steam/callback",
    controller.callback,
  );
  app.post("/v1/auth/exchange", controller.exchange);
}
