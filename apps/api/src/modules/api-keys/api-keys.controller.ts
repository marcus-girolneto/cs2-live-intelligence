import type { FastifyReply, FastifyRequest } from "fastify";
import { ownerOf } from "../../shared/http/principal.js";
import { describeIssues, parseDto } from "../../shared/http/validation.js";
import {
  createKeySchema,
  type ApiKeyListDto,
  type CreatedKeyDto,
} from "./api-keys.dto.js";
import type { ApiKeysService } from "./api-keys.service.js";

type ById = FastifyRequest<{ Params: { id: string } }>;

/** Session-authenticated key management (Settings → Developers). */
export class ApiKeysController {
  constructor(private readonly keys: ApiKeysService) {}

  list = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<ApiKeyListDto> => {
    reply.header("cache-control", "no-store");
    return this.keys.list(ownerOf(request));
  };

  create = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<CreatedKeyDto> => {
    const body = parseDto(
      createKeySchema,
      request.body,
      (e) => `Invalid API key request: ${describeIssues(e, 3)}`,
      { code: "invalid_request" },
    );
    reply.code(201).header("cache-control", "no-store");
    return this.keys.create(ownerOf(request), body);
  };

  revoke = async (request: ById): Promise<{ revoked: true }> =>
    this.keys.revoke(ownerOf(request), request.params.id);
}
