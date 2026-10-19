import { feedbackSchema } from "@cs2/contracts";
import { body, schema, operation, id } from "./helpers.js";

/** Demos, matches, analyses, replay, coaching, AI, admin, plans and billing. */
export const productPaths = {
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
  "/v1/analyses/{id}/replay/meta": {
    get: operation(
      "Owner replay metadata: map, tickRate, sampleHz, rounds {number,duration,winner,ct,t}, players {steamId,name,team}, bounds, cell and outline [[x,y]] (occupancy cell centers); 404 when no replay is stored",
      { parameters: id },
    ),
  },
  "/v1/analyses/{id}/replay": {
    get: operation(
      "Owner replay window ?round=N&from=&to= (seconds since freeze end, at most 40 s): players, weapons, frames {t,p:[[i,x,y,yaw,hp,alive,weapon,flashed,armor]]} and events (kill, damage, flashed, bomb, shot, grenade)",
      {
        parameters: [
          ...id,
          {
            name: "round",
            in: "query",
            required: true,
            schema: { type: "integer", minimum: 1 },
          },
          {
            name: "from",
            in: "query",
            required: false,
            schema: { type: "number", minimum: 0 },
          },
          {
            name: "to",
            in: "query",
            required: false,
            schema: { type: "number", minimum: 0 },
          },
        ],
      },
    ),
  },
  "/v1/analyses/{id}/coaching": {
    post: operation(
      "Per-player AI review {steamId, lang, tier: quick|deep (default quick)}. Reserves the tier's credits before the model call (quick 1; deep 3, 2 on Pro; admin-editable), commits after the review is saved, releases on failure. 402 {code: insufficient_credits, tier, needed, balance, packs, upgradeTo}; 402 {code: plan_limit, feature: ai_review} at the per-account daily safety cap. Returns {reviewId, steamId, tier, creditsSpent, balance, call:{latencyMs, attempts}, coaching (quick: igl-review-v6; deep: igl-review-v7-deep with coaching.deep {utility, crosshair, positioning, rounds, history?, caveats}, up to 10 keyMoments and 6 area-tagged drills), personalization}. Model/provider identity only for admins",
      { parameters: id },
    ),
  },
  "/v1/coach/progress": {
    get: operation(
      "Player progress: timeline, learned profile (with perMap), reviews, live calls, maps:[{map, matches, rounds, lastPlayedAt, metrics, recurring, places, openPlanItems, openPlanFrom}], generalPlan, generalPlanFrom",
    ),
  },
  "/v1/ai/status": {
    get: operation(
      "AI availability. Non-admins: {configured, purposes:{review:{configured}, live:{configured}}}; admins also get provider details",
    ),
  },
  "/v1/ai/test": {
    post: operation("Admin only: connectivity check with a real model call"),
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
  "/v1/admin/ai/providers": {
    get: operation(
      "Admin only: list AI provider profiles (keys never returned) and assignments",
    ),
    post: operation(
      "Admin only: create a provider profile; API key stored AES-256-GCM encrypted",
    ),
  },
  "/v1/admin/ai/providers/{id}": {
    put: operation(
      "Admin only: update a provider profile (omit apiKey to keep it, null to clear)",
      { parameters: id },
    ),
    delete: operation("Admin only: delete an unassigned provider profile", {
      parameters: id,
    }),
  },
  "/v1/admin/ai/providers/{id}/test": {
    post: operation(
      "Admin only: real connectivity call with optional {{model}}",
      { parameters: id },
    ),
  },
  "/v1/admin/ai/providers/{id}/models": {
    get: operation(
      "Admin only: model ids from the provider's /models endpoint",
      { parameters: id },
    ),
  },
  "/v1/admin/ai/assignments": {
    get: operation(
      "Admin only: provider + model per purpose (review_quick, review_deep, live, report; legacy key review = both review tiers)",
    ),
    put: operation(
      "Admin only: set or clear (null) the provider + model per purpose",
    ),
  },
  "/v1/admin/settings": {
    get: operation("Admin only: app-wide settings and effective values"),
    put: operation(
      "Admin only: update dailyLimit, maxInputBytes, sampleDemoEnabled",
    ),
  },
  "/v1/admin/users": {
    get: operation("Admin only: list accounts with roles and usage counts"),
  },
  "/v1/admin/users/{id}/role": {
    put: operation(
      "Admin only: set role user|admin; the last admin cannot be demoted",
      { parameters: id },
    ),
  },
  "/v1/admin/analyses/reprocess": {
    post: operation(
      "Admin only: re-queue finished demo jobs whose demo file is still stored, optionally {ownerId}; returns {queued}",
    ),
  },
  "/v1/admin/audit": {
    get: operation("Admin only: recent admin actions (no secrets)"),
  },
  "/v1/plans": {
    get: operation(
      "Active plans {plans:[{id,name,prices:{BRL?,USD?:{month,year}} (cents),limits:{aiReviewsPerDay,liveAiMatchesPerDay,uploadsPerDay,retentionDaysMax (null = unlimited),monthlyCredits},features:{clipExport,perMapLearning,cheaperDeep,monthlyReport,reel,deepHistory,priorityQueue},credits:{monthly,quickCost,deepCost},benefits:[enabled feature keys]}]}",
    ),
  },
  "/v1/admin/plans": {
    get: operation("Admin only: every plan with active, sort and stripePrices"),
    put: operation(
      "Admin only: update the plan named by body.id (same body as /v1/admin/plans/{id})",
    ),
  },
  "/v1/admin/plans/{id}": {
    put: operation(
      "Admin only: partial update {name?,prices?,limits?,features?,stripePrices?,active?,sort?}; the free plan cannot be deactivated",
      { parameters: id },
    ),
  },
  "/v1/admin/users/{id}/plan": {
    put: operation(
      "Admin only: manual grant {planId, until?: ISO datetime|null} (source admin); returns {userId, plan}",
      { parameters: id },
    ),
  },
  "/v1/billing/status": {
    get: operation(
      "{enabled:false} or {enabled:true, provider, currencies, intervals, paymentMethods}",
    ),
  },
  "/v1/billing/checkout": {
    post: operation(
      "{planId, interval: month|year, currency: BRL|USD} → {url} (hosted checkout); 503 {code: billing_disabled} when not configured",
    ),
  },
  "/v1/billing/portal": {
    post: operation(
      "→ {url} (customer billing portal); 404 before any purchase",
    ),
  },
  "/v1/billing/webhook": {
    post: operation(
      "Payment provider webhook (raw JSON body, Stripe-Signature verified, idempotent by event id)",
    ),
  },
};
