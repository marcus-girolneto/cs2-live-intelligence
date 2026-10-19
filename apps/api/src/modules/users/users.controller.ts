import type { FastifyReply, FastifyRequest } from "fastify";
import { ownerOf } from "../../shared/http/principal.js";
import type { MeDto } from "./users.dto.js";
import type { UsersService } from "./users.service.js";

export class UsersController {
  constructor(private readonly users: UsersService) {}

  me = async (request: FastifyRequest, reply: FastifyReply): Promise<MeDto> => {
    reply.header("cache-control", "no-store");
    return this.users.me(ownerOf(request));
  };

  refreshProfile = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<MeDto> => {
    reply.header("cache-control", "no-store");
    return this.users.refresh(ownerOf(request));
  };
}
