import type { ReplayMetaDto, ReplayWindowDto } from "./replay.dto.js";
import type { FastifyRequest } from "fastify";
import { ownerOf } from "../../shared/http/principal.js";
import { parseDto } from "../../shared/http/validation.js";
import { replayParamsSchema, replayWindowQuerySchema } from "./replay.dto.js";
import type { ReplayService } from "./replay.service.js";

const INVALID = { code: "invalid_request" } as const;

/** Parses request DTOs and delegates to the service (auth runs as a preHandler). */
export class ReplayController {
  constructor(private readonly service: ReplayService) {}

  private id(request: FastifyRequest): string {
    return parseDto(
      replayParamsSchema,
      request.params,
      "Invalid analysis id",
      INVALID,
    ).id;
  }

  meta = async (request: FastifyRequest): Promise<ReplayMetaDto> =>
    this.service.meta(ownerOf(request), this.id(request));

  window = async (request: FastifyRequest): Promise<ReplayWindowDto> => {
    const ownerId = ownerOf(request);
    const id = this.id(request);
    const query = parseDto(
      replayWindowQuerySchema,
      request.query,
      "Query must be round=<1..1000>, optional from/to in seconds (to > from).",
      INVALID,
    );
    return this.service.window(ownerId, id, query);
  };
}
