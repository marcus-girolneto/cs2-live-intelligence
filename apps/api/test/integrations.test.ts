import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Pool } from "pg";
import type { FastifyInstance } from "fastify";
import { TestDatabase } from "./support/test-database.js";
import { buildApp } from "../src/app.js";
import { RuntimeEnv } from "../src/config/env.js";
import { signStripePayload } from "../src/infrastructure/billing/stripe-payment-gateway.js";
import { testDatabaseUrl } from "./support/database-url.js";

const databaseUrl = testDatabaseUrl();
const STEAM_ID = "76561197960287930";
const STEAM_KEY = "0123456789ABCDEF0123456789ABCDEF"; // gitleaks:allow (test fixture)
const STRIPE_KEY = "sk_test_integrationKey4242"; // gitleaks:allow (fake test value)
const WEBHOOK = "whsec_integrationWebhook77"; // gitleaks:allow (fake test value)

describe.skipIf(!databaseUrl)("admin integrations (Postgres)", () => {
  let admin: Pool;
  let repo: TestDatabase;
  let app: FastifyInstance;
  let directory: string;
  const schema = "integrations_" + randomUUID().replaceAll("-", "");
  const boss = { authorization: "Bearer boss-token" };
  const user = { authorization: "Bearer user-token" };
  const env: Record<string, string | undefined> = {
    APP_ENCRYPTION_KEY: "integrations-test-key",
  };
  const steamKeys: (string | null)[] = [];
  const stripeCalls: { url: string; auth: string }[] = [];
  let balanceStatus = 200;

  const steamFetch = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.hostname === "api.steampowered.com") {
      steamKeys.push(url.searchParams.get("key"));
      if (url.pathname.includes("GetPlayerSummaries"))
        return Response.json({
          response: { players: [{ steamid: STEAM_ID, personaname: "Boss" }] },
        });
      return new Response("{}", { status: 404 });
    }
    return new Response("", { status: 503 }); // community XML unavailable
  }) as typeof fetch;
  const integrationFetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    if (url.startsWith("https://api.stripe.com/")) {
      stripeCalls.push({ url, auth: headers.authorization ?? "" });
      if (url.endsWith("/v1/balance"))
        return balanceStatus === 200
          ? Response.json({ object: "balance", livemode: false })
          : Response.json(
              { error: { message: `Invalid API Key provided: ${STRIPE_KEY}` } },
              { status: balanceStatus },
            );
      return Response.json({ url: "https://checkout.stripe.test/s" });
    }
    return steamFetch(input, init);
  }) as typeof fetch;

  const call = (
    method: "GET" | "PUT" | "POST",
    url: string,
    headers: Record<string, string> = boss,
    payload?: unknown,
  ) =>
    app.inject({
      method,
      url,
      headers,
      ...(payload === undefined ? {} : { payload: payload as object }),
    });

  beforeAll(async () => {
    admin = new Pool({ connectionString: databaseUrl });
    await admin.query(`create schema ${schema}`);
    const url = new URL(databaseUrl!);
    url.searchParams.set("options", `-c search_path=${schema}`);
    repo = new TestDatabase(url.toString());
    await repo.migrate();
    await repo.seedDev("boss", "boss-token", "boss-device", "boss-dev-token");
    await repo.seedDev("user", "user-token", "user-device", "user-dev-token");
    await repo.pool.query(
      "update users set role='admin', steam_id=$1 where id='boss'",
      [STEAM_ID],
    );
    await repo.pool.query("update users set steam_id=$1 where id='user'", [
      "76561197960287931",
    ]);
    directory = await mkdtemp(resolve(tmpdir(), "cs2-integrations-"));
    repo.storageDir = directory;
    app = await buildApp({
      database: repo,
      devices: [],
      owners: [],
      webOrigin: "https://app.example",
      apiPublicUrl: "https://api.example",
      jobs: {
        storageDir: directory,
        parserBin: process.execPath,
        disableWorker: true,
      },
      env: new RuntimeEnv(() => env),
      steamFetch,
      integrationFetch,
    });
  });
  afterAll(async () => {
    await app?.close();
    await repo?.close();
    await admin?.query(`drop schema if exists ${schema} cascade`);
    await admin?.end();
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("is admin only (401 without a session, 403 for users)", async () => {
    for (const [method, url, payload] of [
      ["GET", "/v1/admin/integrations", undefined],
      ["PUT", "/v1/admin/integrations/steam", { webApiKey: STEAM_KEY }],
      ["PUT", "/v1/admin/integrations/stripe", { enabled: false }],
      ["POST", "/v1/admin/integrations/steam/test", {}],
    ] as const) {
      const anonymous = await call(method, url, {}, payload);
      expect(anonymous.statusCode).toBe(401);
      expect(anonymous.json()).toMatchObject({ code: "unauthorized" });
      const forbidden = await call(method, url, user, payload);
      expect(forbidden.statusCode).toBe(403);
      expect(forbidden.json()).toMatchObject({ code: "forbidden" });
    }
    const rows = await repo.pool.query("select count(*) from app_secrets");
    expect(Number(rows.rows[0].count)).toBe(0);
  });

  it("starts unconfigured, falls back to env and reports the source", async () => {
    let view = (await call("GET", "/v1/admin/integrations")).json();
    expect(view).toMatchObject({
      steam: { configured: false, source: "none", last4: null },
      stripe: {
        configured: false,
        source: "none",
        webhookConfigured: false,
        enabled: true,
        active: false,
        paymentMethods: { BRL: ["card"], USD: ["card"] },
        webhookUrl: "https://api.example/v1/billing/webhook",
      },
      apiPublicUrl: "https://api.example",
    });
    env.STEAM_WEB_API_KEY = "envSteamKey000000000abcd";
    view = (await call("GET", "/v1/admin/integrations")).json();
    expect(view.steam).toMatchObject({
      configured: true,
      source: "env",
      last4: "abcd",
    });
    delete env.STEAM_WEB_API_KEY;
  });

  it("stores the Steam key encrypted, audits without the value and uses it without a restart", async () => {
    await call("POST", "/v1/me/refresh-profile", user);
    expect(steamKeys).toEqual([]); // no key yet: public profile only

    expect(
      (
        await call("PUT", "/v1/admin/integrations/steam", boss, {
          webApiKey: "not a key!",
        })
      ).statusCode,
    ).toBe(400);
    const saved = await call("PUT", "/v1/admin/integrations/steam", boss, {
      webApiKey: STEAM_KEY,
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.body).not.toContain(STEAM_KEY);
    expect(saved.json().steam).toMatchObject({
      configured: true,
      source: "database",
      last4: "CDEF",
    });

    const row = (
      await repo.pool.query(
        "select ciphertext,last4,updated_by from app_secrets where name='steam.webApiKey'",
      )
    ).rows[0];
    expect(row.ciphertext).not.toBe(STEAM_KEY);
    expect(row.ciphertext).not.toContain(STEAM_KEY);
    expect(row.ciphertext.startsWith("v1:")).toBe(true);
    expect(row).toMatchObject({ last4: "CDEF", updated_by: "boss" });

    // The next Steam call (this same process) carries the saved key.
    const me = await call("POST", "/v1/me/refresh-profile");
    expect(me.statusCode).toBe(200);
    expect(steamKeys.length).toBeGreaterThan(0);
    expect(new Set(steamKeys)).toEqual(new Set([STEAM_KEY]));

    const test = await call("POST", "/v1/admin/integrations/steam/test");
    expect(test.statusCode).toBe(200);
    expect(test.json()).toMatchObject({
      ok: true,
      latencyMs: expect.any(Number),
    });
    expect(test.body).not.toContain(STEAM_KEY);

    const audit = (await call("GET", "/v1/admin/audit")).body;
    expect(audit).toContain("integrations.steam.update");
    expect(audit).toContain("integrations.test");
    expect(audit).not.toContain(STEAM_KEY);

    // Clearing removes the row (env fallback would apply again).
    const cleared = await call("PUT", "/v1/admin/integrations/steam", boss, {
      webApiKey: null,
    });
    expect(cleared.json().steam).toMatchObject({
      configured: false,
      source: "none",
    });
  });

  it("enables, rotates and disables Stripe billing at runtime", async () => {
    expect((await call("GET", "/v1/billing/status", user)).json()).toEqual({
      enabled: false,
    });
    expect(
      (
        await call("PUT", "/v1/admin/integrations/stripe", boss, {
          secretKey: "pk_live_wrongkind",
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await call("PUT", "/v1/admin/integrations/stripe", boss, {
          surprise: true,
        })
      ).statusCode,
    ).toBe(400);

    const saved = await call("PUT", "/v1/admin/integrations/stripe", boss, {
      secretKey: STRIPE_KEY,
      webhookSecret: WEBHOOK,
      publishableKey: "pk_test_publishable42", // gitleaks:allow
      paymentMethods: { BRL: ["card", "pix"] },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.body).not.toContain(STRIPE_KEY);
    expect(saved.body).not.toContain(WEBHOOK);
    expect(saved.json().stripe).toMatchObject({
      configured: true,
      source: "database",
      secretKeyLast4: "4242",
      webhookConfigured: true,
      webhookSource: "database",
      publishableKey: "pk_test_publishable42", // gitleaks:allow
      enabled: true,
      active: true,
      paymentMethods: { BRL: ["card", "pix"], USD: ["card"] },
    });
    const secrets = await repo.pool.query(
      "select name,ciphertext from app_secrets order by name",
    );
    expect(secrets.rows.map((r) => r.name)).toEqual([
      "stripe.secretKey",
      "stripe.webhookSecret",
    ]);
    for (const r of secrets.rows) {
      expect(r.ciphertext).not.toContain(STRIPE_KEY);
      expect(r.ciphertext).not.toContain(WEBHOOK);
    }

    // Billing is live immediately, with the admin-managed options.
    expect((await call("GET", "/v1/billing/status", user)).json()).toEqual({
      enabled: true,
      provider: "stripe",
      currencies: ["BRL", "USD"],
      intervals: ["month", "year"],
      paymentMethods: { BRL: ["card", "pix"], USD: ["card"] },
      publishableKey: "pk_test_publishable42", // gitleaks:allow
    });
    await repo.pool.query(
      `update plans set stripe_prices='{"BRL_month":"price_basic_brl"}'::jsonb where id='basic'`,
    );
    const checkout = await call("POST", "/v1/billing/checkout", user, {
      planId: "basic",
      interval: "month",
      currency: "BRL",
    });
    expect(checkout.statusCode).toBe(200);
    expect(stripeCalls.at(-1)?.auth).toBe(`Bearer ${STRIPE_KEY}`);

    // The stored webhook secret verifies deliveries.
    const event = JSON.stringify({
      id: "evt_integrations_1",
      type: "invoice.payment_failed",
      data: { object: { customer: "cus_unknown" } },
    });
    const hook = await app.inject({
      method: "POST",
      url: "/v1/billing/webhook",
      headers: {
        "content-type": "application/json",
        "stripe-signature": signStripePayload(event, WEBHOOK),
      },
      payload: event,
    });
    expect(hook.statusCode).toBe(200);

    // Live test: GET /v1/balance with the stored key; errors never echo it.
    const ok = await call("POST", "/v1/admin/integrations/stripe/test");
    expect(ok.json()).toMatchObject({ ok: true, livemode: false });
    expect(stripeCalls.at(-1)?.url).toBe("https://api.stripe.com/v1/balance");
    balanceStatus = 401;
    const bad = await call("POST", "/v1/admin/integrations/stripe/test");
    expect(bad.json()).toMatchObject({ ok: false });
    expect(bad.body).not.toContain(STRIPE_KEY);
    balanceStatus = 200;
    expect(
      (await call("POST", "/v1/admin/integrations/paypal/test")).statusCode,
    ).toBe(404);

    // Admin switch off: billing disabled on the next request, keys kept.
    const off = await call("PUT", "/v1/admin/integrations/stripe", boss, {
      enabled: false,
    });
    expect(off.json().stripe).toMatchObject({
      enabled: false,
      active: false,
      configured: true,
      secretKeyLast4: "4242",
    });
    expect((await call("GET", "/v1/billing/status", user)).json()).toEqual({
      enabled: false,
    });
    const disabled = await call("POST", "/v1/billing/checkout", user, {
      planId: "basic",
      interval: "month",
      currency: "BRL",
    });
    expect(disabled.statusCode).toBe(503);
    expect(disabled.json()).toMatchObject({ code: "billing_disabled" });

    await call("PUT", "/v1/admin/integrations/stripe", boss, { enabled: true });
    expect(
      (await call("GET", "/v1/billing/status", user)).json(),
    ).toMatchObject({ enabled: true });
    // Clearing the webhook secret turns billing off (signatures can't be verified).
    const noHook = await call("PUT", "/v1/admin/integrations/stripe", boss, {
      webhookSecret: null,
    });
    expect(noHook.json().stripe).toMatchObject({
      webhookConfigured: false,
      active: false,
    });
    expect((await call("GET", "/v1/billing/status", user)).json()).toEqual({
      enabled: false,
    });

    const audit = (await call("GET", "/v1/admin/audit?limit=500")).body;
    expect(audit).toContain("integrations.stripe.update");
    expect(audit).not.toContain(STRIPE_KEY);
    expect(audit).not.toContain(WEBHOOK);
  });

  it("applies the admin time zone to the app clock without a restart", async () => {
    let settings = (await call("GET", "/v1/admin/settings")).json();
    expect(settings.settings.timezone).toBeNull();
    expect(settings.effective.timezone).toBe("America/Sao_Paulo");
    expect(
      (
        await call("PUT", "/v1/admin/settings", boss, {
          timezone: "Mars/Olympus",
        })
      ).statusCode,
    ).toBe(400);
    settings = (
      await call("PUT", "/v1/admin/settings", boss, { timezone: "UTC" })
    ).json();
    expect(settings.settings.timezone).toBe("UTC");
    expect(settings.effective.timezone).toBe("UTC");
    settings = (
      await call("PUT", "/v1/admin/settings", boss, { timezone: null })
    ).json();
    expect(settings.effective.timezone).toBe("America/Sao_Paulo");
  });
});
