import { zodToJsonSchema } from "zod-to-json-schema";
import {
  settingsSchema,
  pairingRequestSchema,
  pairingClaimSchema,
  feedbackSchema,
} from "@cs2/contracts";
const json = (schema: unknown) => ({ "application/json": { schema } });
const body = (schema: unknown) => ({ required: true, content: json(schema) });
const success = {
  200: { description: "Successful owner-scoped response" },
  400: { description: "Invalid request" },
  401: { description: "Unauthorized" },
  403: { description: "Consent required" },
  404: { description: "Resource not found" },
  429: { description: "Quota exceeded" },
};
const schema = (value: Parameters<typeof zodToJsonSchema>[0]) =>
  zodToJsonSchema(value, { target: "openApi3" });
const secured = { security: [{ bearer: [] }] };
const operation = (summary: string, extra: Record<string, unknown> = {}) => ({
  ...secured,
  summary,
  responses: success,
  ...extra,
});
const id = [
  { name: "id", in: "path", required: true, schema: { type: "string" } },
];
export const platformOpenApiPaths = {
  "/ready": {
    get: {
      summary: "Database readiness",
      responses: {
        200: { description: "Ready" },
        503: { description: "Database unavailable" },
      },
    },
  },
  "/metrics": {
    get: {
      summary: "Aggregate process counters; no identifiers",
      responses: { 200: { description: "Prometheus text counters" } },
    },
  },
  "/v1/me": { get: operation("Current authenticated owner") },
  "/v1/auth/logout": {
    post: operation(
      "Revoke current application token and owner live channels",
      {
        responses: {
          204: { description: "Logged out" },
          401: { description: "Unauthorized" },
        },
      },
    ),
  },
  "/v1/auth/steam/start": {
    get: {
      summary: "Begin fixed-provider Steam OpenID; relay HttpOnly CSRF cookie",
      responses: {
        200: {
          description: "Steam authentication URL",
          content: json({
            type: "object",
            required: ["url"],
            properties: { url: { type: "string", format: "uri" } },
          }),
        },
      },
    },
  },
  "/v1/auth/steam/callback": {
    get: {
      summary:
        "Validate Steam signature, return_to, browser state and one-use nonce",
      responses: {
        302: {
          description:
            "Redirect to web callback with one-use code and HttpOnly exchange-binding cookie",
        },
        400: { description: "Rejected authentication" },
        502: { description: "Steam unavailable" },
      },
    },
  },
  "/v1/auth/exchange": {
    post: {
      summary:
        "Consume code with cs2_steam_exchange cookie; token valid 30 days",
      requestBody: body({
        type: "object",
        required: ["code"],
        properties: { code: { type: "string" } },
      }),
      responses: {
        200: { description: "Application bearer token" },
        400: { description: "Expired, replayed or unbound code" },
      },
    },
  },
  "/v1/settings": {
    get: operation("Read consent and retention settings"),
    put: operation(
      "Set explicit consent and retention; withdrawal cancels queued analysis",
      { requestBody: body(schema(settingsSchema)) },
    ),
  },
  "/v1/account": {
    delete: operation(
      "Delete account metadata and credentials immediately; enqueue durable object deletion",
      {
        responses: {
          204: { description: "Deleted; filesystem purge queued" },
          401: { description: "Unauthorized" },
        },
      },
    ),
  },
  "/v1/devices": { get: operation("List owned devices without credentials") },
  "/v1/devices/pair": {
    post: operation("Create five-minute one-use collector pairing code", {
      requestBody: body(schema(pairingRequestSchema)),
    }),
  },
  "/v1/devices/claim": {
    post: {
      summary:
        "Collector consumes pairing or rotation code; secret returned only here",
      requestBody: body(schema(pairingClaimSchema)),
      responses: {
        200: { description: "Device ID and secret token" },
        400: { description: "Invalid or consumed code" },
        429: { description: "Rate limit" },
      },
    },
  },
  "/v1/devices/{id}/rotate": {
    post: operation(
      "Invalidate old secret; return five-minute code to claim replacement for same device",
      { parameters: id },
    ),
  },
  "/v1/devices/{id}": {
    delete: operation("Revoke owned device and close live channels", {
      parameters: id,
      responses: {
        204: { description: "Revoked" },
        401: { description: "Unauthorized" },
        404: { description: "Device not found" },
      },
    }),
  },
  "/v1/live/sessions": {
    get: operation("List latest 100 owned GSI session states"),
  },
  "/v1/demos/uploads": {
    post: operation(
      "Stream .dem upload; default cap 64 MiB; consent and quotas required",
      {
        parameters: [
          {
            name: "x-filename",
            in: "header",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/octet-stream": {
              schema: { type: "string", format: "binary" },
            },
          },
        },
        responses: {
          202: { description: "Durable queued job {id,status}" },
          400: { description: "Invalid filename or empty upload" },
          401: { description: "Unauthorized" },
          403: { description: "Consent required" },
          413: { description: "Upload cap exceeded" },
          415: { description: "Use application/octet-stream" },
          429: { description: "Upload/storage quota reached" },
        },
      },
    ),
  },
  "/v1/matches": { get: operation("List latest 100 owner demo jobs") },
  "/v1/matches/{id}": {
    get: operation(
      "Owner demo job status: queued, processing, complete or failed",
      { parameters: id },
    ),
  },
  "/v1/analyses/{id}": {
    get: operation(
      "Owner complete deterministic metrics and evidence-cited coaching including provenance",
      { parameters: id },
    ),
  },
  "/v1/feedback": {
    post: operation("Store consent-based rating; daily cap 20", {
      requestBody: body(schema(feedbackSchema)),
      responses: {
        201: { description: "Feedback ID" },
        400: { description: "Invalid feedback" },
        401: { description: "Unauthorized" },
        403: { description: "Analytics consent required or quota reached" },
      },
    }),
  },
  "/v1/events": {
    post: operation(
      "Store consent-based bounded scalar product event; daily cap 1000",
      {
        requestBody: body({
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", pattern: "^[a-z][a-z0-9_]{0,63}$" },
            properties: { type: "object", maxProperties: 10 },
          },
        }),
        responses: {
          202: { description: "Event accepted" },
          400: { description: "Invalid event" },
          401: { description: "Unauthorized" },
          403: { description: "Analytics consent required or quota reached" },
        },
      },
    ),
  },
};
