import { randomUUID } from "node:crypto";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { AppError, TooManyRequestsError } from "../../shared/errors/index.js";
import { bearerToken } from "../../shared/http/principal.js";
import type { ApiKeyPrincipal, ApiScope } from "../api-keys/api-keys.dto.js";
import type { ApiKeysService } from "../api-keys/api-keys.service.js";
import { KeyRateLimiter, type PlanIdLookup } from "./key-rate-limit.js";

declare module "fastify" {
  interface FastifyRequest {
    apiKey?: ApiKeyPrincipal;
    requestId?: string;
  }
  interface FastifyContextConfig {
    /** The API key scope an /api/v1 route requires (absent: public, e.g. openapi.json). */
    scope?: ApiScope;
  }
}

export const EXPOSED_HEADERS =
  "X-Request-Id, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, Retry-After, Idempotent-Replayed";
export const ALLOWED_HEADERS =
  "Authorization, Content-Type, X-Filename, Idempotency-Key, X-Request-Id, Accept-Encoding";

const DEFAULT_CODES: Record<number, string> = {
  400: "invalid_request",
  401: "unauthorized",
  402: "payment_required",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  413: "payload_too_large",
  415: "unsupported_media_type",
  429: "quota_exceeded",
  500: "internal_error",
  502: "upstream_failed",
  503: "service_unavailable",
  504: "upstream_timeout",
};
export const defaultCode = (status: number): string =>
  DEFAULT_CODES[status] ??
  (status >= 500 ? "internal_error" : "invalid_request");

/** `{error: {code, message, details?, requestId}}` for any error raised under /api/v1. */
export function publicErrorBody(
  error: unknown,
  requestId: string,
): {
  status: number;
  body: Record<string, unknown>;
  headers: Record<string, string>;
} {
  if (error instanceof AppError) {
    const details = Object.keys(error.details).length
      ? error.details
      : undefined;
    return {
      status: error.statusCode,
      headers: error.headers,
      body: {
        error: {
          code: error.code ?? defaultCode(error.statusCode),
          message: error.message,
          ...(details ? { details } : {}),
          requestId,
        },
      },
    };
  }
  const status = (error as FastifyError).statusCode ?? 500;
  const message =
    status >= 500
      ? "Internal server error"
      : status === 413
        ? "Payload exceeds size limit"
        : ((error as Error).message || "Invalid request").slice(0, 200);
  return {
    status,
    headers: {},
    body: { error: { code: defaultCode(status), message, requestId } },
  };
}

/**
 * The /api/v1 front door, as one onRequest hook: request id, CORS without credentials (any
 * origin may call with a key; no cookies are ever read, so there is no CSRF surface), API key
 * authentication, per-key rate limiting by plan (RateLimit-* headers) and the route's scope.
 */
export class PublicApiGate {
  constructor(
    private readonly keys: ApiKeysService,
    private readonly limiter: KeyRateLimiter,
    private readonly plans: PlanIdLookup,
  ) {}

  onRequest = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const incoming = request.headers["x-request-id"];
    request.requestId =
      typeof incoming === "string" && /^[A-Za-z0-9._-]{8,128}$/.test(incoming)
        ? incoming
        : randomUUID();
    reply.header("x-request-id", request.requestId);
    reply.header("access-control-allow-origin", "*");
    reply.header("access-control-expose-headers", EXPOSED_HEADERS);
    reply.header("cache-control", "no-store");
    reply.header("x-content-type-options", "nosniff");
    const scope = request.routeOptions.config.scope;
    if (request.method === "OPTIONS" || !scope) return;
    const key = await this.keys.authenticate(bearerToken(request), request.ip);
    request.apiKey = key;
    request.principal = { ownerId: key.ownerId };
    const limit = KeyRateLimiter.limitFor(await this.plans.planId(key.ownerId));
    const decision = this.limiter.hit(key.keyId, limit);
    reply.header("ratelimit-limit", String(decision.limit));
    reply.header("ratelimit-remaining", String(decision.remaining));
    reply.header("ratelimit-reset", String(decision.resetSeconds));
    if (!decision.allowed)
      throw new TooManyRequestsError(
        `Rate limit of ${decision.limit} requests per minute reached for this API key`,
        {
          code: "rate_limited",
          headers: { "retry-after": String(decision.resetSeconds) },
          details: { retryAfterSeconds: decision.resetSeconds },
        },
      );
    await this.keys.authorize(key, scope);
  };

  /** CORS preflight for every /api/v1 path. */
  preflight = async (
    _request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply> =>
    reply
      .code(204)
      .header("access-control-allow-methods", "GET, POST, DELETE, OPTIONS")
      .header("access-control-allow-headers", ALLOWED_HEADERS)
      .header("access-control-max-age", "600")
      .send();

  errorHandler = (
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply,
  ): FastifyReply => {
    const { status, body, headers } = publicErrorBody(
      error,
      request.requestId ?? request.id,
    );
    for (const [name, value] of Object.entries(headers))
      reply.header(name, value);
    return reply.code(status).send(body);
  };

  notFound = (request: FastifyRequest, reply: FastifyReply): FastifyReply => {
    reply.header("access-control-allow-origin", "*");
    return reply.code(404).send({
      error: {
        code: "not_found",
        message: `No route ${request.method} ${request.url.split("?")[0]}`,
        requestId: request.requestId ?? request.id,
      },
    });
  };
}
