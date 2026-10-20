import { z } from "zod";
import {
  createWebhookSchema,
  deliveriesQuerySchema,
  WEBHOOK_EVENTS,
} from "../../webhooks/webhooks.dto.js";
import {
  error,
  jsonSchema,
  ok,
  pathParam,
  queryParameters,
} from "./helpers.js";
import type { OperationSpec } from "./operations.js";

type Json = Record<string, unknown>;

const webhookSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  events: z.array(z.enum(WEBHOOK_EVENTS)),
  active: z.boolean(),
  consecutiveFailures: z.number().int(),
  disabledReason: z.string().nullable(),
  createdAt: z.string().datetime(),
});
const deliverySchema = z.object({
  id: z.string().uuid(),
  webhookId: z.string().uuid(),
  event: z.string(),
  status: z.enum(["pending", "delivered", "failed"]),
  attempts: z.number().int(),
  lastStatus: z.number().int().nullable(),
  lastError: z.string().nullable(),
  nextAttemptAt: z.string().nullable(),
  createdAt: z.string().datetime(),
  deliveredAt: z.string().nullable(),
});
const webhookId = pathParam("id", "Webhook id");

export const webhookOperations: OperationSpec[] = [
  {
    method: "get",
    path: "/webhooks",
    scope: "webhooks:manage",
    tag: "Webhooks",
    operationId: "listWebhooks",
    summary: "Your webhooks",
    responses: {
      200: ok(
        "Webhooks",
        jsonSchema(z.object({ webhooks: z.array(webhookSchema) })),
      ),
    },
  },
  {
    method: "post",
    path: "/webhooks",
    scope: "webhooks:manage",
    tag: "Webhooks",
    operationId: "createWebhook",
    summary: "Register a webhook (the signing secret is returned once)",
    description:
      "The URL must be https and resolve to a public address (private, loopback, link-local and cloud metadata addresses are refused, also at delivery time). Up to 5 webhooks per account.",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: jsonSchema(createWebhookSchema),
          example: {
            url: "https://example.com/fragmind/webhook",
            events: ["demo.completed", "demo.failed", "review.completed"],
          },
        },
      },
    },
    responses: {
      201: ok(
        "Created; store `secret` now, it is not shown again",
        jsonSchema(webhookSchema.extend({ secret: z.string() })),
      ),
      400: error(
        "Invalid URL or events (invalid_webhook_url, invalid_request)",
      ),
      409: error("Webhook limit reached (webhook_limit)"),
    },
  },
  {
    method: "get",
    path: "/webhooks/deliveries",
    scope: "webhooks:manage",
    tag: "Webhooks",
    operationId: "listWebhookDeliveries",
    summary: "Recent deliveries and their outcome",
    parameters: queryParameters(deliveriesQuerySchema),
    responses: {
      200: ok(
        "Deliveries, newest first",
        jsonSchema(z.object({ deliveries: z.array(deliverySchema) })),
      ),
    },
  },
  {
    method: "delete",
    path: "/webhooks/{id}",
    scope: "webhooks:manage",
    tag: "Webhooks",
    operationId: "deleteWebhook",
    summary: "Delete a webhook",
    parameters: [webhookId],
    responses: {
      200: ok("Deleted", {
        type: "object",
        properties: { deleted: { const: true } },
      }),
      404: error("No such webhook"),
    },
  },
  {
    method: "post",
    path: "/webhooks/{id}/test",
    scope: "webhooks:manage",
    tag: "Webhooks",
    operationId: "testWebhook",
    summary: "Send a signed ping now and report the receiver's answer",
    parameters: [webhookId],
    responses: {
      200: ok(
        "Outcome of the ping",
        jsonSchema(
          z.object({
            delivered: z.boolean(),
            status: z.number().int().nullable(),
            error: z.string().nullable(),
          }),
        ),
      ),
      404: error("No such webhook"),
    },
  },
];

const eventBody = (type: string, data: Json, example: Json): Json => ({
  type: "object",
  required: ["id", "type", "createdAt", "data"],
  properties: {
    id: {
      type: "string",
      format: "uuid",
      description: "Delivery id (stable across retries)",
    },
    type: { const: type },
    createdAt: { type: "string", format: "date-time" },
    data: { type: "object", properties: data },
  },
  example: {
    id: "3f0c...",
    type,
    createdAt: "2026-10-19T18:23:42.000Z",
    data: example,
  },
});

const signed = (summary: string, body: Json): Json => ({
  post: {
    summary,
    description:
      "POSTed to your URL as JSON. Verify FragMind-Signature: t=<unix seconds>,v1=<hex>, where v1 = HMAC-SHA256(secret, `${t}.${rawBody}`); reject timestamps older than 5 minutes. Answer 2xx within 10 seconds; other answers are retried with exponential backoff (8 attempts over about an hour). 20 consecutive failures disable the webhook.",
    parameters: [
      {
        name: "FragMind-Signature",
        in: "header",
        required: true,
        schema: { type: "string" },
      },
      {
        name: "FragMind-Event",
        in: "header",
        required: true,
        schema: { type: "string" },
      },
      {
        name: "FragMind-Delivery",
        in: "header",
        required: true,
        schema: { type: "string" },
      },
    ],
    requestBody: {
      required: true,
      content: { "application/json": { schema: body } },
    },
    responses: { 200: { description: "Any 2xx acknowledges the delivery" } },
  },
});

/** OpenAPI 3.1 `webhooks`: what FragMind sends to your endpoint. */
export const webhookEvents: Json = {
  "demo.completed": signed(
    "A demo finished processing",
    eventBody(
      "demo.completed",
      {
        demoId: { type: "string" },
        filename: { type: "string" },
        status: { const: "complete" },
        map: { type: ["string", "null"] },
        links: { type: "object" },
      },
      {
        demoId: "8d7c...",
        filename: "faceit-mirage.dem",
        status: "complete",
        map: "de_mirage",
      },
    ),
  ),
  "demo.failed": signed(
    "A demo could not be analysed",
    eventBody(
      "demo.failed",
      {
        demoId: { type: "string" },
        filename: { type: "string" },
        status: { const: "failed" },
        error: { type: ["string", "null"] },
      },
      {
        demoId: "8d7c...",
        filename: "broken.dem",
        status: "failed",
        error: "Demo could not be parsed",
      },
    ),
  ),
  "review.completed": signed(
    "An AI review was saved (requested through the API, the app or an auto review)",
    eventBody(
      "review.completed",
      {
        reviewId: { type: "string" },
        demoId: { type: "string" },
        steamId: { type: "string" },
        tier: { enum: ["quick", "deep", "team"] },
      },
      {
        reviewId: "51b2...",
        demoId: "8d7c...",
        steamId: "76561198000000000",
        tier: "quick",
      },
    ),
  ),
};
