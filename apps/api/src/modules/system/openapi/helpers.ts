import { zodToJsonSchema } from "zod-to-json-schema";

type JsonContent = { "application/json": { schema: unknown } };

/** Shared OpenAPI fragments for the path tables. */
export const json = (schema: unknown): JsonContent => ({
  "application/json": { schema },
});
export const body = (
  schema: unknown,
): { required: true; content: JsonContent } => ({
  required: true,
  content: json(schema),
});
export const success = {
  200: { description: "Successful owner-scoped response" },
  400: { description: "Invalid request" },
  401: { description: "Unauthorized" },
  403: { description: "Consent required" },
  404: { description: "Resource not found" },
  429: { description: "Quota exceeded" },
};
export const schema = (
  value: Parameters<typeof zodToJsonSchema>[0],
): ReturnType<typeof zodToJsonSchema> =>
  zodToJsonSchema(value, { target: "openApi3" });
export const secured = { security: [{ bearer: [] }] };
export const operation = (
  summary: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({
  ...secured,
  summary,
  responses: success,
  ...extra,
});
export const id = [
  { name: "id", in: "path", required: true, schema: { type: "string" } },
];
