import type { FastifyReply, FastifyRequest } from "fastify";
import { deviceOf } from "../../shared/http/principal.js";
import type { TelemetryService } from "./telemetry.service.js";

export class TelemetryController {
  constructor(private readonly telemetry: TelemetryService) {}

  ingest = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply> =>
    reply
      .code(202)
      .send(await this.telemetry.ingest(deviceOf(request), request.body));
}
