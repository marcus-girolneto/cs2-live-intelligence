import { API_SCOPES, SCOPE_DESCRIPTIONS } from "../../api-keys/api-keys.dto.js";
import { errorSchema } from "../public-api.dto.js";
import { commonErrors, jsonSchema } from "./helpers.js";
import {
  accountOperations,
  demoOperations,
  type OperationSpec,
} from "./operations.js";
import { webhookEvents, webhookOperations } from "./webhooks.js";

type Json = Record<string, unknown>;

/** Every documented /api/v1 operation (the spec test checks it matches the route table). */
export const PUBLIC_OPERATIONS: OperationSpec[] = [
  ...demoOperations,
  ...accountOperations,
  ...webhookOperations,
];

const DESCRIPTION = `The FragMind public API: upload Counter-Strike 2 demos, read analyses and player metrics, request AI reviews and get webhooks when work finishes.

**Authentication.** Create a personal API key in the app (Settings, Developers) and send it as \`Authorization: Bearer fm_live_...\`. Keys carry scopes; each operation lists the one it needs. Keys are shown once; revoke a leaked key right away.

**Errors** always look like \`{"error": {"code", "message", "details?", "requestId"}}\`. Codes are stable; messages may change.

**Rate limits** per key and minute: Free 60, Basic 120, Pro 300. Every answer carries RateLimit-Limit, RateLimit-Remaining and RateLimit-Reset; a 429 carries Retry-After. Uploads also follow the app's upload limits and plan quotas.

**CORS.** Any origin may call the API without credentials (cookies are never used). Do not ship keys in public web pages.`;

function operation(spec: OperationSpec): Json {
  return {
    operationId: spec.operationId,
    tags: [spec.tag],
    summary: spec.summary,
    description: `${spec.description ? spec.description + "\n\n" : ""}Required scope: \`${spec.scope}\`.`,
    "x-required-scope": spec.scope,
    security: [{ ApiKey: [spec.scope] }],
    ...(spec.parameters ? { parameters: spec.parameters } : {}),
    ...(spec.requestBody ? { requestBody: spec.requestBody } : {}),
    responses: { ...commonErrors, ...spec.responses },
  };
}

/** The OpenAPI 3.1 document served at /api/v1/openapi.json. */
export function publicOpenApiDocument(serverUrl: string): Json {
  const paths: Record<string, Json> = {};
  for (const spec of PUBLIC_OPERATIONS)
    paths[spec.path] = { ...paths[spec.path], [spec.method]: operation(spec) };
  return {
    openapi: "3.1.0",
    info: {
      title: "FRAGMIND Public API",
      version: "1.0.0",
      description: DESCRIPTION,
    },
    servers: [{ url: `${serverUrl.replace(/\/$/, "")}/api/v1` }],
    tags: [
      { name: "Demos", description: "Upload, list and delete demos" },
      {
        name: "Analyses",
        description: "Analysis documents and player metrics",
      },
      { name: "Reviews", description: "AI reviews (spend credits)" },
      { name: "Account", description: "Account, plan, credits and progress" },
      { name: "Webhooks", description: "Get notified when work finishes" },
    ],
    security: [{ ApiKey: [] }],
    paths,
    webhooks: webhookEvents,
    components: {
      securitySchemes: {
        ApiKey: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "fm_live_<32 characters>",
          description: `Personal API key. Scopes: ${API_SCOPES.map((s) => `\`${s}\` (${SCOPE_DESCRIPTIONS[s]})`).join(", ")}`,
        },
      },
      schemas: { Error: jsonSchema(errorSchema) },
    },
  };
}
