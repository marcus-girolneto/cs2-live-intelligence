import { body, id, operation } from "./helpers.js";

const steamId = [
  ...id,
  { name: "steamId", in: "query", required: true, schema: { type: "string" } },
];
const limit = [
  {
    name: "limit",
    in: "query",
    required: false,
    schema: { type: "integer", minimum: 1, maximum: 200, default: 50 },
  },
];
const json = (description: string) => ({ type: "object", description });

/** Credits, review tiers, packs, Pro reports, reel and personal coach. */
export const creditsPaths = {
  "/v1/credits/ledger": {
    get: operation(
      "Caller's credit ledger, newest first: {entries:[{id, delta, reason: welcome|plan_grant|purchase|review_quick|review_deep|refund|admin_adjust|expire, bucket: plan|bonus|purchased, ref?, note?, expiresAt?, createdAt}]}",
      { parameters: limit },
    ),
  },
  "/v1/credits/packs": {
    get: {
      summary:
        "Public credit packs {packs:[{id, name, credits, prices:{BRL?,USD?} (cents), badge?}]}",
      responses: { 200: { description: "Active packs in display order" } },
    },
  },
  "/v1/billing/credits/checkout": {
    post: operation(
      "{packId, currency: BRL|USD} → {url} (one-time Stripe Checkout, mode=payment, metadata {kind: credits, packId, ownerId, credits}); the paid checkout.session.completed / async_payment_succeeded webhook credits the purchased bucket once per session; 503 {code: billing_disabled}",
      { requestBody: body(json("{packId, currency}")) },
    ),
  },
  "/v1/analyses/{id}/reviews": {
    get: operation(
      "Saved reviews of this match and player (no cost to re-open): {analysisId, steamId, latest:{quick: reviewId|null, deep: reviewId|null}, reviews:[{reviewId, tier, createdAt, creditsSpent, promptVersion, lang, rating, coaching, provider?/model? (admins)}]}",
      { parameters: steamId },
    ),
  },
  "/v1/analyses/{id}/reel": {
    get: operation(
      "Pro: full-match reel for continuous video export {analysisId, steamId, map, totalSeconds, clips:[{round, from, to, focusSteamId, eventIds, label, kind: highlight|mistake, title, score}]} in match order; 402 {code: plan_feature, feature: reel, upgradeTo}",
      { parameters: steamId },
    ),
  },
  "/v1/reports": {
    get: operation(
      "Monthly performance reports {reports:[{id, period: YYYY-MM, source: scheduled|on_demand, createdAt, matches, headline?}]}",
    ),
  },
  "/v1/reports/{id}": {
    get: operation(
      "One report {id, period, source, createdAt, matches, headline?, report:{schemaVersion, period, steamId, matches, rounds, trends[], maps[], recurringMistakes[], utilityCrosshair[], best, worst, narrative?:{headline, summary, strengths, focus, plan}, caveats}}",
      { parameters: id },
    ),
  },
  "/v1/reports/generate": {
    post: operation(
      "Pro: generate this month's report now (once per period; AI purpose report, no credits) {lang?} → report; 402 plan_feature; 409 {code: report_exists, reportId, period}; scheduled reports for the previous month are written in the first 3 days of each month",
      { requestBody: body(json("{lang?: en|pt}")) },
    ),
  },
  "/v1/admin/credits/settings": {
    get: operation(
      "Admin: {settings:{welcomeCredits, quickCost, deepCost, proDeepCost, dailySafetyCap, minSteamAgeDays, maxGrantsPerNetwork, networkWindowDays}}",
    ),
    put: operation("Admin: partial update of the credit settings (audited)", {
      requestBody: body(json("Partial credit settings")),
    }),
  },
  "/v1/admin/credits/packs": {
    get: operation(
      "Admin: all packs {packs:[{id, name, credits, prices, badge?, stripePrices, active, sort}]}",
    ),
    put: operation(
      "Admin: upsert packs {packs:[...]} (deactivate instead of deleting; audited)",
      {
        requestBody: body(json("{packs}")),
      },
    ),
  },
  "/v1/admin/users/{id}/ledger": {
    get: operation("Admin: a user's ledger {userId, entries}", {
      parameters: [...id, ...limit],
    }),
  },
  "/v1/admin/users/{id}/credits": {
    post: operation(
      "Admin: ledger admin_adjust {delta (≠0), note, bucket?: plan|bonus|purchased (default bonus)} → {userId, result, credits}; negative deltas cannot exceed the bucket's free balance (400 insufficient_credits); audited",
      { parameters: id, requestBody: body(json("{delta, note, bucket?}")) },
    ),
  },
};
