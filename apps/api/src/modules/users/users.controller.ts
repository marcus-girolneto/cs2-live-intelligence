import type { FastifyReply, FastifyRequest } from "fastify";
import { ownerOf } from "../../shared/http/principal.js";
import { parseDto } from "../../shared/http/validation.js";
import { languageBodySchema, type MeDto } from "./users.dto.js";
import type { UsersService } from "./users.service.js";

export class UsersController {
  constructor(private readonly users: UsersService) {}

  me = async (request: FastifyRequest, reply: FastifyReply): Promise<MeDto> => {
    reply.header("cache-control", "no-store");
    return this.users.me(ownerOf(request));
  };

  setLanguage = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const body = parseDto(
      languageBodySchema,
      request.body,
      "lang must be one of: en, pt, es, ru, zh, de, fr, pl, tr.",
    );
    await this.users.setLanguage(ownerOf(request), body.lang);
    reply.code(204).send();
  };

  refreshProfile = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<MeDto> => {
    reply.header("cache-control", "no-store");
    return this.users.refresh(ownerOf(request));
  };
}
