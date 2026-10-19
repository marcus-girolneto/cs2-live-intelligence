import { zodToJsonSchema } from "zod-to-json-schema";
import { envelopeSchema, liveStateSchema } from "@cs2/contracts";
import { accountPaths } from "./account-paths.js";
import { livePaths } from "./live-paths.js";
import { productPaths } from "./product-paths.js";

/** The OpenAPI 3.0 document served at /openapi.json. */
export function openApiDocument(): Record<string, unknown> {
  return {
    openapi: "3.0.3",
    info: {
      title: "CS2 Live Intelligence API",
      version: "1.0.0",
      description:
        "WebSocket /v1/live?sessionId=...&ticket=... requires allowed Origin and a single-use ticket. Server emits snapshot {state:LiveState|null}, diff {sessionId,sequence,changes:LiveState} and heartbeat {at:ISO8601}. Replace the full state on each diff to clear missing fields. Reconnect using a fresh ticket to receive latest snapshot.",
    },
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
      schemas: {
        TelemetryEnvelope: zodToJsonSchema(envelopeSchema, {
          target: "openApi3",
        }),
        LiveState: zodToJsonSchema(liveStateSchema, { target: "openApi3" }),
      },
    },
    paths: { ...accountPaths, ...productPaths, ...livePaths },
  };
}
