/** Structured logger port. Services log through it, never through Fastify's request.log. */
export interface Logger {
  info(fields: Record<string, unknown>, message: string): void;
}

/** Discards everything (the API runs Fastify with `logger: false`). */
export const silentLogger: Logger = { info: () => undefined };
