import type { FastifyReply, FastifyRequest } from "fastify";
import { ownerOf } from "../../shared/http/principal.js";
import { parseDto } from "../../shared/http/validation.js";
import { settingsRequestSchema, type SettingsDto } from "./privacy.dto.js";
import type { PrivacyService } from "./privacy.service.js";

export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  settings = async (request: FastifyRequest): Promise<SettingsDto> =>
    this.privacy.settings(ownerOf(request));

  update = async (request: FastifyRequest): Promise<SettingsDto> =>
    this.privacy.update(
      ownerOf(request),
      parseDto(settingsRequestSchema, request.body, "Invalid settings"),
    );

  deleteAccount = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply> => {
    await this.privacy.deleteAccount(ownerOf(request));
    return reply.code(204).send();
  };
}
