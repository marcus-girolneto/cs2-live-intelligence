import type { FastifyReply, FastifyRequest } from "fastify";
import { ValidationError } from "../../shared/errors/index.js";
import { ownerOf } from "../../shared/http/principal.js";
import { parseDto } from "../../shared/http/validation.js";
import {
  eventNameSchema,
  eventPropertiesSchema,
  feedbackRequestSchema,
} from "./feedback.dto.js";
import type { FeedbackService } from "./feedback.service.js";

export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  submit = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply> => {
    const body = parseDto(
      feedbackRequestSchema,
      request.body,
      "Invalid feedback",
    );
    return reply
      .code(201)
      .send(await this.feedback.submit(ownerOf(request), body));
  };

  track = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply> => {
    const ownerId = ownerOf(request);
    const body = request.body as {
      name?: unknown;
      properties?: unknown;
    } | null;
    const name = eventNameSchema.safeParse(body?.name);
    if (!body || !name.success) throw new ValidationError("Invalid event");
    const properties = eventPropertiesSchema.safeParse(body.properties ?? {});
    if (!properties.success)
      throw new ValidationError("Invalid event properties");
    await this.feedback.track(ownerId, name.data, properties.data);
    return reply.code(202).send({ accepted: true });
  };
}
