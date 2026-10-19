/** Telemetry ingest and the owner's live session endpoints. */
export const livePaths = {
  "/health": { get: { responses: { 200: { description: "Healthy" } } } },
  "/v1/telemetry/gsi": {
    post: {
      security: [{ bearer: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/TelemetryEnvelope" },
          },
        },
      },
      responses: {
        202: { description: "Accepted, duplicate or ignored older event" },
        400: { description: "Invalid envelope" },
        401: { description: "Invalid device token" },
        403: { description: "Device or session mismatch" },
        413: { description: "Payload too large" },
        429: { description: "Rate limited" },
      },
    },
  },
  "/v1/live/sessions/{id}": {
    get: {
      security: [{ bearer: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: {
        200: {
          description: "Latest live state",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LiveState" },
            },
          },
        },
        401: { description: "Unauthorized" },
        404: { description: "No owned session" },
      },
    },
  },
  "/v1/live/tickets": {
    post: {
      security: [{ bearer: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["sessionId"],
              properties: { sessionId: { type: "string", maxLength: 128 } },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Single use WS ticket, expires in 30 seconds",
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["ticket"],
                properties: { ticket: { type: "string" } },
              },
            },
          },
        },
        401: { description: "Unauthorized" },
        404: { description: "No owned session" },
      },
    },
  },
};
