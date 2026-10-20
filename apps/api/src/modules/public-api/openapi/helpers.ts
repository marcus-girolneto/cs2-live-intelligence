import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodTypeAny } from "zod";
import { z } from "zod";

type Json = Record<string, unknown>;

/** JSON Schema (2020-12 compatible, as OpenAPI 3.1 expects) of a zod schema, inlined. */
export function jsonSchema(schema: ZodTypeAny): Json {
  const out = zodToJsonSchema(schema, {
    target: "jsonSchema7",
    $refStrategy: "none",
  }) as Json;
  delete out.$schema;
  return out;
}

/** Query parameters of a zod object schema (required unless optional or defaulted). */
export function queryParameters(schema: z.AnyZodObject): Json[] {
  return Object.entries(schema.shape as Record<string, ZodTypeAny>).map(
    ([name, field]) => {
      const required = !field.isOptional();
      const description = field.description;
      return {
        name,
        in: "query",
        required,
        ...(description ? { description } : {}),
        schema: jsonSchema(field),
      };
    },
  );
}

export const pathParam = (name: string, description: string): Json => ({
  name,
  in: "path",
  required: true,
  description,
  schema: { type: "string" },
});

export const jsonContent = (schema: Json, example?: unknown): Json => ({
  "application/json": { schema, ...(example ? { example } : {}) },
});

const rateHeaders = {
  "RateLimit-Limit": {
    description: "Requests allowed per minute for this key (by plan)",
    schema: { type: "integer" },
  },
  "RateLimit-Remaining": {
    description: "Requests left in the current window",
    schema: { type: "integer" },
  },
  "RateLimit-Reset": {
    description: "Seconds until the window restarts",
    schema: { type: "integer" },
  },
  "X-Request-Id": {
    description:
      "Request id (also in error bodies); send it when reporting a problem",
    schema: { type: "string" },
  },
};

export const ok = (
  description: string,
  schema?: Json,
  example?: unknown,
): Json => ({
  description,
  headers: rateHeaders,
  ...(schema ? { content: jsonContent(schema, example) } : {}),
});

const errorRef = { $ref: "#/components/schemas/Error" };
export const error = (description: string, extra: Json = {}): Json => ({
  description,
  content: { "application/json": { schema: errorRef } },
  ...extra,
});

/** Errors every authenticated operation can return. */
export const commonErrors: Json = {
  401: error(
    "Missing, invalid, expired or revoked API key (missing_api_key, invalid_api_key, api_key_expired, api_key_revoked)",
  ),
  403: error(
    "The key lacks the scope this operation requires (insufficient_scope)",
  ),
  429: error(
    "Rate limit reached for this key (rate_limited); see Retry-After",
    {
      headers: {
        "Retry-After": {
          description: "Seconds to wait before retrying",
          schema: { type: "integer" },
        },
      },
    },
  ),
};
