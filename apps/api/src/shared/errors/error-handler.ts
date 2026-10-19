import type { FastifyError, FastifyInstance } from "fastify";
import { appErrorResponse } from "./app-error.js";

/**
 * The single error → HTTP mapping. AppErrors carry their status and body; anything else
 * (Fastify validation, body limits, unexpected exceptions) keeps the original generic bodies.
 */
export function installErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    const known = appErrorResponse(error);
    if (known) {
      for (const [name, value] of Object.entries(known.headers))
        reply.header(name, value);
      return reply.code(known.status).send(known.body);
    }
    const status = error.statusCode ?? 500;
    return reply.code(status).send({
      error:
        status >= 500
          ? "Internal server error"
          : status === 413
            ? "Payload exceeds size limit"
            : "Invalid request",
    });
  });
}
