import {
  steamUpdateSchema,
  stripeUpdateSchema,
} from "../../integrations/integrations.dto.js";
import { body, schema, operation } from "./helpers.js";

const adminResponses = {
  200: { description: "Successful admin response" },
  400: { description: "Invalid request (code invalid_request)" },
  401: { description: "Unauthorized (code unauthorized)" },
  403: { description: "Administrator role required (code forbidden)" },
};
const view =
  "Returns {steam:{configured, source: database|env|none, last4, updatedAt, undecryptable?}, stripe:{configured, source, secretKeyLast4, webhookConfigured, webhookSource, publishableKey, enabled, active, paymentMethods:{BRL,USD}, updatedAt, webhookUrl, undecryptable?}, apiPublicUrl}. Secrets are never returned.";

/** Admin-managed third-party integrations (Steam Web API, Stripe). */
export const integrationsPaths = {
  "/v1/admin/integrations": {
    get: operation(`Admin only: integration status. ${view}`, {
      responses: adminResponses,
    }),
  },
  "/v1/admin/integrations/steam": {
    put: operation(
      `Admin only: set {webApiKey} or clear it with null (encrypted at rest, audited without the value; applies to the next Steam call). ${view}`,
      {
        requestBody: body(schema(steamUpdateSchema)),
        responses: adminResponses,
      },
    ),
  },
  "/v1/admin/integrations/stripe": {
    put: operation(
      `Admin only: {secretKey?, webhookSecret?, publishableKey?, enabled?, paymentMethods?:{BRL?,USD?}}; omitted keeps, null clears. Billing is active when enabled and both secrets are set; changes apply to the next request. ${view}`,
      {
        requestBody: body(schema(stripeUpdateSchema)),
        responses: adminResponses,
      },
    ),
  },
  "/v1/admin/integrations/{name}/test": {
    post: operation(
      "Admin only: live check of the credential in effect. steam: GetPlayerSummaries for the admin's own SteamID; stripe: GET /v1/balance. Returns {ok, latencyMs, detail, livemode? (stripe)}",
      {
        parameters: [
          {
            name: "name",
            in: "path",
            required: true,
            schema: { type: "string", enum: ["steam", "stripe"] },
          },
        ],
        responses: {
          ...adminResponses,
          404: { description: "Unknown integration" },
        },
      },
    ),
  },
};
