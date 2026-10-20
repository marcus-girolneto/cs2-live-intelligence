import { AiError } from "@cs2/coaching";
import { SecretKeyUnavailable } from "../../infrastructure/secrets/aes-gcm-secret-cipher.js";
import { AppError, InternalError } from "../../shared/errors/index.js";
import type { Logger } from "../../shared/logging/logger.js";

/** Non-admins get generic messages: provider errors can name the model or vendor. */
const PUBLIC_AI_ERRORS: Record<string, string> = {
  timeout: "The AI coach took too long to answer. Try again in a moment.",
  truncated: "The coach couldn't finish this answer. Try again in a moment.",
  invalid_output:
    "The coach couldn't finish this answer. Try again in a moment.",
  between_rounds_only: "The live coach only speaks between rounds.",
  input_too_large: "This match is too large for the AI coach.",
};

const statusOf = (error: AiError): number =>
  error.code === "timeout"
    ? 504
    : error.code === "between_rounds_only"
      ? 409
      : 502;

/**
 * Maps a failed model request to the HTTP error the coach endpoints answer with:
 * 504 timeout, 409 between-rounds, 502 otherwise; `code` is always `ai_<reason>`.
 */
export function aiRequestError(
  error: unknown,
  admin: boolean,
  logger?: Logger,
): AppError {
  // The technical reason (provider status, budget hints) stays in the logs.
  logger?.info(
    {
      code: error instanceof AiError ? error.code : "failed",
      reason: error instanceof Error ? error.message : String(error),
      ...(error instanceof AiError && error.status
        ? { providerStatus: error.status }
        : {}),
    },
    "ai request failed",
  );
  if (error instanceof AiError && !admin)
    return new AppError(
      statusOf(error),
      PUBLIC_AI_ERRORS[error.code] ??
        "The AI coach is unavailable right now. Try again later.",
      { code: `ai_${error.code}` },
    );
  if (error instanceof AiError)
    return new AppError(statusOf(error), error.message, {
      code: `ai_${error.code}`,
      details: error.status ? { providerStatus: error.status } : {},
    });
  return new AppError(502, "The AI request failed.", { code: "ai_failed" });
}

/** Admin provider test: `{ok:false,…}` bodies, 504 on timeout and 502 otherwise. */
export function providerTestError(error: unknown): AppError {
  const ai = error instanceof AiError;
  return new AppError(
    ai && error.code === "timeout" ? 504 : 502,
    ai ? error.message : "The AI request failed.",
    {
      details: {
        ok: false,
        code: ai ? `ai_${error.code}` : "ai_failed",
        ...(ai && error.status ? { providerStatus: error.status } : {}),
      },
    },
  );
}

/** Maps a missing encryption key to its safe 500; rethrows anything else. */
export function secretFailure(error: unknown): never {
  if (error instanceof SecretKeyUnavailable)
    throw new InternalError(error.message);
  throw error;
}
