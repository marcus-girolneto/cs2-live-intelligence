/** Error from an HTTP endpoint, keeping the status and the machine-readable code. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly missing?: string[],
    /** Full JSON error body (e.g. plan_limit details on 402). */
    readonly body?: Record<string, unknown>,
  ) {
    super(message);
  }
  /** The `error` text the server sent, when it sent one. */
  get serverMessage(): string | undefined {
    return typeof this.body?.error === "string" ? this.body.error : undefined;
  }
}

export const isApiError = (e: unknown, status?: number): e is ApiError =>
  e instanceof ApiError && (status === undefined || e.status === status);
