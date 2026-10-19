import type { ZodError, ZodType, ZodTypeDef } from "zod";
import { ValidationError, type AppErrorOptions } from "../errors/index.js";

/** "path: message; …" for the first `limit` issues (used in admin/plan error bodies). */
export function describeIssues(error: ZodError, limit = 5): string {
  return error.issues
    .slice(0, limit)
    .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
    .join("; ");
}

/**
 * Parses a request DTO or throws a 400 with the given message. `message` may be a function of
 * the zod error for endpoints that report which fields were wrong.
 */
export function parseDto<Output, Input = Output>(
  schema: ZodType<Output, ZodTypeDef, Input>,
  value: unknown,
  message: string | ((error: ZodError) => string),
  options: AppErrorOptions = {},
): Output {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new ValidationError(
    typeof message === "string" ? message : message(parsed.error),
    options,
  );
}
