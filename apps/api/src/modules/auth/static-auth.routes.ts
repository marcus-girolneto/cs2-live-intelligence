import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import { bearerToken, ownerOf } from "../../shared/http/principal.js";
import type { OwnerInvalidation } from "../live/owner-invalidation.js";
import type { StaticIdentity } from "./identity.js";

/** Memory mode: logout revokes the static token for the process lifetime. */
export class StaticLogoutController {
  constructor(
    private readonly identity: StaticIdentity,
    private readonly invalidation: OwnerInvalidation,
  ) {}

  logout = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply> => {
    const ownerId = ownerOf(request);
    this.identity.revoke(bearerToken(request));
    this.invalidation.invalidate(ownerId);
    return reply.code(204).send();
  };
}

export function registerStaticAuthRoutes(
  app: FastifyInstance,
  controller: StaticLogoutController,
  guards: AuthGuards,
): void {
  app.post(
    "/v1/auth/logout",
    { preHandler: guards.requireUser },
    controller.logout,
  );
}
