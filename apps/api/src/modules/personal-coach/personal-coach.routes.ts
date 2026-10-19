import type { FastifyInstance } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import type { PersonalCoachController } from "./personal-coach.controller.js";

/** Route table only (coded guards). */
export function registerPersonalCoachRoutes(
  app: FastifyInstance,
  controller: PersonalCoachController,
  guards: AuthGuards,
): void {
  const user = { preHandler: guards.requireUser };
  app.get("/v1/coach/personal", user, controller.get);
  app.post<{ Body: { lang?: unknown } | null }>(
    "/v1/coach/personal/generate",
    user,
    controller.generate,
  );
}
