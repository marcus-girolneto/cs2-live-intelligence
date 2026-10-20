import {
  settingsSchema,
  pairingRequestSchema,
  pairingClaimSchema,
} from "@cs2/contracts";
import { languageBodySchema } from "../../users/users.dto.js";
import { json, body, schema, operation, id } from "./helpers.js";

/** Readiness, metrics, auth, account, settings and devices. */
export const accountPaths = {
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
  "/v1/me": {
    get: operation(
      "Current owner: role, Steam id, cached public Steam profile (refreshed when older than 6 h), plan, usage {aiReviews (daily safety cap), liveAiMatches, uploads} and credits {balance, buckets:{plan,bonus,purchased}, planExpiresAt?, welcome:{status: granted|ineligible|pending, reason?}, costs:{quick,deep}}",
    ),
  },
  "/v1/me/language": {
    put: operation(
      "Save the interface and AI language chosen in the web selector (en, pt, es, ru, zh, de, fr, pl, tr); GET /v1/me returns it as lang. Scheduled reports are written in it.",
      {
        requestBody: body(schema(languageBodySchema)),
        responses: {
          204: { description: "Saved" },
          400: { description: "Unknown language" },
          401: { description: "Unauthorized" },
        },
      },
    ),
  },
  "/v1/me/refresh-profile": {
    post: operation(
      "Force a Steam profile refresh; once per 60 s per account (429 with retryAfterSeconds)",
    ),
  },
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
};
