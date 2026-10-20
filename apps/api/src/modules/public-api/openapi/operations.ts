import type { ApiScope } from "../../api-keys/api-keys.dto.js";
import {
  createdReviewSchema,
  demoPageSchema,
  demoSchema,
  demosQuerySchema,
  ledgerQuerySchema,
  ledgerSchema,
  meSchema,
  playerResponseSchema,
  progressQuerySchema,
  reviewListSchema,
  reviewSchema,
  reviewsQuerySchema,
  uploadAcceptedSchema,
  analysisResponseSchema,
} from "../public-api.dto.js";
import {
  error,
  jsonSchema,
  ok,
  pathParam,
  queryParameters,
} from "./helpers.js";

type Json = Record<string, unknown>;
export type OperationSpec = {
  method: "get" | "post" | "delete";
  path: string;
  scope: ApiScope;
  tag: string;
  operationId: string;
  summary: string;
  description?: string;
  parameters?: Json[];
  requestBody?: Json;
  responses: Json;
};

const demoId = pathParam("id", "Demo id (returned by the upload)");
const notFound = error("No such demo for this account (not_found)");
const notReady = error(
  "The demo is still queued or processing, or failed (demo_not_ready, details.status)",
);
const exampleDemo = {
  id: "8d7c2f1e-4b1a-4c7e-9a55-0d1f3c2b9e10",
  filename: "faceit-mirage.dem",
  status: "complete",
  error: null,
  createdAt: "2026-10-19T18:22:05.000Z",
  completedAt: "2026-10-19T18:23:41.000Z",
  ownership: "mine",
  playerSteamId: "76561198000000000",
  match: {
    map: "de_mirage",
    rounds: 24,
    score: { ct: 13, t: 11 },
    tickRate: 64,
    parserVersion: "cs2live.6",
    players: 10,
  },
  links: {
    self: "https://api.example.com/api/v1/demos/8d7c2f1e-4b1a-4c7e-9a55-0d1f3c2b9e10",
  },
};

/** Demos, analyses and players. */
export const demoOperations: OperationSpec[] = [
  {
    method: "post",
    path: "/demos",
    scope: "matches:write",
    tag: "Demos",
    operationId: "uploadDemo",
    summary: "Upload a CS2 demo",
    description:
      "Stream the raw .dem bytes as the request body (no multipart). The same checks as the web upload apply: telemetry consent, your plan's daily upload quota and storage quota, 10 uploads per minute per account and 30 per network, at most 4 concurrent uploads, the admin size limit (500 MB by default) and a CS2 demo signature check on the bytes. A demo already analysed for anyone completes immediately. Send an Idempotency-Key to retry safely: the first response is replayed for 24 hours.",
    parameters: [
      {
        name: "X-Filename",
        in: "header",
        required: true,
        description:
          "A plain .dem file name (letters, digits, space, _ ( ) . -)",
        schema: { type: "string", example: "faceit-mirage.dem" },
      },
      {
        name: "Idempotency-Key",
        in: "header",
        required: false,
        description: "Up to 128 characters of A-Z a-z 0-9 _ . : -",
        schema: { type: "string", example: "upload-2026-10-19-mirage" },
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
      202: ok(
        "Queued for analysis; poll the demo or wait for demo.completed",
        jsonSchema(uploadAcceptedSchema),
      ),
      400: error(
        "Invalid filename or not a CS2 demo (not_cs2_demo, too_small)",
      ),
      403: error("Telemetry consent required, or the key lacks matches:write"),
      409: error(
        "The same Idempotency-Key is still in progress (idempotency_in_progress)",
      ),
      413: error("Larger than the upload limit (too_large)"),
      415: error("Use Content-Type: application/octet-stream"),
      429: error(
        "Upload rate (upload_rate_limited, with Retry-After), concurrency or daily/storage quota (quota_exceeded) reached",
      ),
    },
  },
  {
    method: "get",
    path: "/demos",
    scope: "matches:read",
    tag: "Demos",
    operationId: "listDemos",
    summary: "List your demos (newest first, cursor pagination)",
    parameters: queryParameters(demosQuerySchema),
    responses: {
      200: ok("One page of demos", jsonSchema(demoPageSchema), {
        data: [exampleDemo],
        nextCursor: null,
      }),
      400: error("Invalid query or cursor (invalid_request, invalid_cursor)"),
    },
  },
  {
    method: "get",
    path: "/demos/{id}",
    scope: "matches:read",
    tag: "Demos",
    operationId: "getDemo",
    summary: "Status, ownership and match summary of a demo",
    parameters: [demoId],
    responses: {
      200: ok("The demo", jsonSchema(demoSchema), exampleDemo),
      404: notFound,
    },
  },
  {
    method: "delete",
    path: "/demos/{id}",
    scope: "matches:write",
    tag: "Demos",
    operationId: "deleteDemo",
    summary: "Delete a demo, its analysis link and its reviews",
    parameters: [demoId],
    responses: { 204: { description: "Deleted" }, 404: notFound },
  },
  {
    method: "get",
    path: "/demos/{id}/analysis",
    scope: "analyses:read",
    tag: "Analyses",
    operationId: "getAnalysis",
    summary: "Full analysis: players and their metrics, rounds, evidence",
    description:
      "Gzip-compressed when you send Accept-Encoding: gzip. Add include=events for every parsed event (kills, damage, grenades...), which can be several megabytes.",
    parameters: [demoId, ...queryParametersOfInclude()],
    responses: {
      200: ok("The analysis", jsonSchema(analysisResponseSchema)),
      404: notFound,
      409: notReady,
    },
  },
  {
    method: "get",
    path: "/demos/{id}/players/{steamId}",
    scope: "analyses:read",
    tag: "Analyses",
    operationId: "getPlayer",
    summary: "One player's metrics and how they rank in the lobby",
    parameters: [demoId, pathParam("steamId", "Player SteamID64")],
    responses: {
      200: ok("The player", jsonSchema(playerResponseSchema)),
      404: error("No such demo or player (not_found, player_not_found)"),
      409: notReady,
    },
  },
];

function queryParametersOfInclude(): Json[] {
  return [
    {
      name: "include",
      in: "query",
      required: false,
      description: "events: also return every parsed event",
      schema: { type: "string", enum: ["events"] },
    },
  ];
}

/** Reviews, progress and account. */
export const accountOperations: OperationSpec[] = [
  {
    method: "post",
    path: "/demos/{id}/reviews",
    scope: "reviews:write",
    tag: "Reviews",
    operationId: "createReview",
    summary: "Request an AI review (spends credits)",
    description:
      "Runs synchronously and can take up to a few minutes; use a generous client timeout. quick and deep review one player, team reviews the player's whole team. Costs and the daily safety cap are the same as in the app; a failed review is not charged.",
    parameters: [demoId],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["steamId"],
            additionalProperties: false,
            properties: {
              steamId: { type: "string", description: "Player SteamID64" },
              tier: {
                type: "string",
                enum: ["quick", "deep", "team"],
                default: "quick",
              },
              lang: {
                type: "string",
                default: "en",
                description: "Review language (en, pt...)",
              },
            },
          },
          example: { steamId: "76561198000000000", tier: "quick", lang: "en" },
        },
      },
    },
    responses: {
      201: ok(
        "The saved review and your new balance",
        jsonSchema(createdReviewSchema),
      ),
      402: error(
        "Not enough credits (insufficient_credits, with cost, balance and packs) or daily cap (plan_limit)",
      ),
      404: error("No such demo or player"),
      429: error("AI capacity limit reached; retry later"),
      502: error("The AI provider failed; nothing was charged"),
      503: error("AI is not configured"),
    },
  },
  {
    method: "get",
    path: "/demos/{id}/reviews",
    scope: "analyses:read",
    tag: "Reviews",
    operationId: "listDemoReviews",
    summary: "Saved reviews of a demo (no cost)",
    parameters: [demoId, ...queryParameters(reviewsQuerySchema)],
    responses: {
      200: ok("Saved reviews, newest first", jsonSchema(reviewListSchema)),
      404: notFound,
    },
  },
  {
    method: "get",
    path: "/reviews/{id}",
    scope: "analyses:read",
    tag: "Reviews",
    operationId: "getReview",
    summary: "One saved review",
    parameters: [pathParam("id", "Review id")],
    responses: {
      200: ok("The review", jsonSchema(reviewSchema)),
      404: error("No such review"),
    },
  },
  {
    method: "get",
    path: "/progress",
    scope: "progress:read",
    tag: "Account",
    operationId: "getProgress",
    summary: "Progress across your own matches (optionally one map)",
    parameters: queryParameters(progressQuerySchema),
    responses: {
      200: ok("Trends, per-map numbers and focus areas", { type: "object" }),
    },
  },
  {
    method: "get",
    path: "/me",
    scope: "account:read",
    tag: "Account",
    operationId: "getMe",
    summary: "Your account, plan, credit balance and today's usage",
    responses: { 200: ok("The account", jsonSchema(meSchema)) },
  },
  {
    method: "get",
    path: "/credits/ledger",
    scope: "account:read",
    tag: "Account",
    operationId: "getLedger",
    summary: "Credit movements, newest first",
    parameters: queryParameters(ledgerQuerySchema),
    responses: { 200: ok("Ledger entries", jsonSchema(ledgerSchema)) },
  },
];
