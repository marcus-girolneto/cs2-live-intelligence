import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AuthGuards } from "../../shared/http/guards.js";
import { ownerOf } from "../../shared/http/principal.js";
import { describeIssues, parseDto } from "../../shared/http/validation.js";
import type { AiQualityService } from "./ai-quality.service.js";

/** POST /v1/admin/ai/eval/run body (inline golden analyses and/or the admin's analyses). */
export const evalRunSchema = z
  .object({
    langs: z
      .array(z.enum(["en", "pt"]))
      .max(2)
      .optional(),
    cases: z
      .array(
        z
          .object({
            name: z.string().regex(/^[a-z0-9-]{1,40}$/),
            analysis: z.unknown(),
            steamId: z.string().max(64).optional(),
          })
          .strict(),
      )
      .max(5)
      .optional(),
    analyses: z
      .array(
        z
          .object({
            analysisId: z.string().min(1).max(128),
            steamId: z.string().max(64).optional(),
          })
          .strict(),
      )
      .max(5)
      .optional(),
  })
  .strict();
/** Golden analyses with events are large; only this admin route accepts big bodies. */
export const EVAL_BODY_LIMIT = 64 * 1024 * 1024;

/** Admin AI quality: ratings per prompt variant and the AI eval. */
export class AiQualityController {
  constructor(private readonly quality: AiQualityService) {}

  ratings = async (): Promise<unknown> => this.quality.ratings();
  latest = async (): Promise<unknown> => this.quality.latest();
  run = async (request: FastifyRequest): Promise<unknown> => {
    const body = parseDto(
      evalRunSchema,
      request.body,
      (e) => `Invalid eval request: ${describeIssues(e)}`,
    );
    return this.quality.run(ownerOf(request), body);
  };
}

export function registerAiQualityRoutes(
  app: FastifyInstance,
  controller: AiQualityController,
  guards: AuthGuards,
): void {
  const adminOnly = { preHandler: guards.requireAdmin };
  app.get("/v1/admin/ai/ratings", adminOnly, controller.ratings);
  app.get("/v1/admin/ai/eval/latest", adminOnly, controller.latest);
  app.post(
    "/v1/admin/ai/eval/run",
    { ...adminOnly, bodyLimit: EVAL_BODY_LIMIT },
    controller.run,
  );
}
