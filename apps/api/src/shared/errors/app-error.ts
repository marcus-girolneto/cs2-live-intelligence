/**
 * Application errors. Services throw these; ONE Fastify error handler maps them to HTTP
 * (see error-handler.ts). Messages are safe to show to the caller.
 *
 * The response body is `{ error, code?, ...details }`. `code` is optional because the
 * original API answered most failures with `{ error }` only; modules that always sent a
 * machine-readable code (plans, billing, replay, AI) keep sending it.
 */
export type ErrorBody = { error: string } & Record<string, unknown>;
export interface AppErrorOptions {
  code?: string;
  details?: Record<string, unknown>;
  /** Extra response headers (e.g. retry-after). */
  headers?: Record<string, string>;
}

export class AppError extends Error {
  readonly code: string | undefined;
  readonly details: Record<string, unknown>;
  readonly headers: Record<string, string>;
  constructor(
    readonly statusCode: number,
    message: string,
    options: AppErrorOptions = {},
  ) {
    super(message);
    this.name = new.target.name;
    this.code = options.code;
    this.details = options.details ?? {};
    this.headers = options.headers ?? {};
  }
  body(): ErrorBody {
    return {
      error: this.message,
      ...(this.code ? { code: this.code } : {}),
      ...this.details,
    };
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid request", options: AppErrorOptions = {}) {
    super(400, message, options);
  }
}
export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", options: AppErrorOptions = {}) {
    super(401, message, options);
  }
}
export type PlanFeature = "ai_review" | "live_ai" | "uploads";
/** 402: the caller's plan does not allow more of `feature` until `resetsAt`. */
export class PlanLimitError extends AppError {
  constructor(details: {
    feature: PlanFeature;
    limit: number;
    resetsAt: string;
    upgradeTo: string | null;
    message?: string;
  }) {
    const { message, ...rest } = details;
    super(
      402,
      message ?? `Your plan's daily limit for this feature was reached.`,
      { code: "plan_limit", details: rest },
    );
  }
}
export class ForbiddenError extends AppError {
  constructor(
    message = "Administrator role required",
    options: AppErrorOptions = {},
  ) {
    super(403, message, options);
  }
}
export class NotFoundError extends AppError {
  constructor(message = "Not found", options: AppErrorOptions = {}) {
    super(404, message, options);
  }
}
export class ConflictError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(409, message, options);
  }
}
export class PayloadTooLargeError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(413, message, options);
  }
}
export class UnsupportedMediaTypeError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(415, message, options);
  }
}
export class TooManyRequestsError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(429, message, options);
  }
}
/** 500 with a message that is safe to show (e.g. missing encryption key). */
export class InternalError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(500, message, options);
  }
}
/** 502 (or 504 for timeouts): a dependency failed or answered badly. */
export class UpstreamError extends AppError {
  constructor(
    message: string,
    options: AppErrorOptions & { status?: 502 | 504 } = {},
  ) {
    super(options.status ?? 502, message, {
      code: "upstream_failed",
      ...options,
    });
  }
}
export class ServiceUnavailableError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(503, message, options);
  }
}
export class BillingDisabledError extends ServiceUnavailableError {
  constructor() {
    super("Billing is not configured.", { code: "billing_disabled" });
  }
}

/** Body and status for an AppError, or undefined for any other error. */
export function appErrorResponse(
  error: unknown,
):
  | { status: number; body: ErrorBody; headers: Record<string, string> }
  | undefined {
  return error instanceof AppError
    ? { status: error.statusCode, body: error.body(), headers: error.headers }
    : undefined;
}
