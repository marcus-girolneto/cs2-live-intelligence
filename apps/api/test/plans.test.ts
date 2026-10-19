import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Pool } from "pg";
import type { FastifyInstance } from "fastify";
import { analyzeDemo } from "@cs2/analytics";
import { generateCoaching } from "@cs2/coaching";
import { buildApp } from "../src/app.js";
import { TestDatabase } from "./support/test-database.js";
import { ZonedClock } from "../src/shared/clock/clock.js";
import {
  StripePaymentGateway,
  signStripePayload,
} from "../src/infrastructure/billing/stripe-payment-gateway.js";
import { PgUsageRepository } from "../src/modules/usage/usage.repository.js";
import { effectivePlan } from "./support/test-database.js";

const databaseUrl = process.env.DATABASE_URL;
const WEBHOOK_SECRET = "whsec_integration";

describe.skipIf(!databaseUrl)("plans, quotas and billing (Postgres)", () => {
  let admin: Pool;
  let repo: TestDatabase;
  let app: FastifyInstance;
  let billingApp: FastifyInstance;
  let directory: string;
  let server: Server;
  let now = Date.parse("2026-10-19T15:00:00Z");
  let mode: "ok" | "error" = "ok";
  let hits = 0;
  const stripeCalls: { url: string; body: string; auth: string }[] = [];
  const schema = "plans_" + randomUUID().replaceAll("-", "");
  const user = { authorization: "Bearer user-token" };
  const boss = { authorization: "Bearer boss-token" };
  const saved = { ...process.env };

  beforeAll(async () => {
    admin = new Pool({ connectionString: databaseUrl });
    await admin.query(`create schema ${schema}`);
    const url = new URL(databaseUrl!);
    url.searchParams.set("options", `-c search_path=${schema}`);
    repo = new TestDatabase(url.toString());
    await repo.migrate();
    await repo.seedDev(
      "user",
      "user-token",
      "user-device",
      "user-device-token",
    );
    await repo.seedDev(
      "boss",
      "boss-token",
      "boss-device",
      "boss-device-token",
    );
    await repo.pool.query("update users set role='admin' where id='boss'");
    directory = await mkdtemp(resolve(tmpdir(), "cs2-plans-"));
    // Minimal OpenAI-compatible provider: a valid review for any request.
    server = createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        hits++;
        if (mode === "error") {
          res.writeHead(500, { "content-type": "application/json" });
          return res.end(JSON.stringify({ error: { message: "boom" } }));
        }
        const body = JSON.parse(raw) as { messages: { content: string }[] };
        const user = body.messages[1]!.content;
        const facts = JSON.parse(user.slice(user.indexOf("{"))) as {
          facts?: { id: string }[];
        };
        const content = facts.facts
          ? {
              summary: "Mock.",
              insights: [
                {
                  observation: "x",
                  evidenceIds: [facts.facts[0]!.id],
                  confidence: "low",
                  actionablePractice: "y",
                  caveats: [],
                  kind: "improve",
                },
              ],
              plan: ["z"],
            }
          : {
              call: "Trade.",
              why: "Round 1.",
              focus: "trade",
              confidence: "low",
            };
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: { content: JSON.stringify(content) },
              },
            ],
          }),
        );
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    process.env.AI_PROVIDER = "local-mock";
    process.env.AI_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
    process.env.AI_API_KEY = "sk-test";
    process.env.AI_MODEL = "mock";
    process.env.AI_MAX_ATTEMPTS = "1";
    const common = {
      database: repo,
      devices: [],
      owners: [],
      webOrigin: "https://app.example",
      jobs: {
        storageDir: directory,
        parserBin: process.execPath,
        disableWorker: true,
      },
      clock: new ZonedClock("America/Sao_Paulo", () => now),
    };
    app = await buildApp({ ...common, paymentGateway: null });
    process.env.STRIPE_PRICE_BASIC_MONTHLY = "price_basicmonthly";
    billingApp = await buildApp({
      ...common,
      jobs: { ...common.jobs },
      paymentGateway: new StripePaymentGateway(
        "sk_test_integration", // gitleaks:allow (fake test value)
        WEBHOOK_SECRET,
        (async (input: string | URL | Request, init?: RequestInit) => {
          stripeCalls.push({
            url: String(input),
            body: String(init?.body),
            auth: String(
              (init?.headers as Record<string, string>).authorization,
            ),
          });
          return new Response(
            JSON.stringify({ url: "https://checkout.stripe.test/s" }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }) as typeof fetch,
      ),
    });
  });
  beforeEach(async () => {
    now = Date.parse("2026-10-19T15:00:00Z");
    mode = "ok";
    hits = 0;
    for (const table of [
      "usage_counters",
      "usage_live_matches",
      "subscriptions",
      "demo_jobs",
      "provider_usage",
      "billing_events",
    ])
      await repo.pool.query(`delete from ${table}`);
    await repo.pool.query(
      "update users set retention_days=30, telemetry_consent=true",
    );
  });
  afterAll(async () => {
    process.env = saved;
    await app?.close();
    await billingApp?.close();
    await new Promise((r) => server?.close(r));
    await repo?.close();
    if (directory) await rm(directory, { recursive: true, force: true });
    if (admin) {
      await admin.query(`drop schema ${schema} cascade`);
      await admin.end();
    }
  });
  const upload = (headers = user, target = app) =>
    target.inject({
      method: "POST",
      url: "/v1/demos/uploads",
      headers: {
        ...headers,
        "content-type": "application/octet-stream",
        "x-filename": "m.dem",
      },
      payload: Buffer.from("demo-" + randomUUID()),
    });
  async function analysisFor(owner: string) {
    const id = randomUUID();
    await repo.createJob(owner, {
      id,
      filename: "a.dem",
      objectKey: id + ".dem",
      checksum: "x",
      size: 1,
    });
    await repo.pool.query(
      "update demo_jobs set status='processing', lease_token='t' where id=$1",
      [id],
    );
    const analysis = analyzeDemo(
      JSON.parse(
        await readFile(
          resolve(
            import.meta.dirname,
            "../../../packages/contracts/fixtures/normalized-demo.json",
          ),
          "utf8",
        ),
      ),
    );
    await repo.finishJob(id, "t", {
      analysis,
      coaching: await generateCoaching(analysis),
    });
    return { id, steamId: analysis.players[0]!.steamId };
  }

  it("lists active plans and shows plan + usage on /v1/me", async () => {
    // The catalogue is public (signed-out landing) and identical to the signed-in view.
    const anonymous = await app.inject({ url: "/v1/plans" });
    expect(anonymous.statusCode).toBe(200);
    const plans = (await app.inject({ url: "/v1/plans", headers: user })).json()
      .plans;
    expect(anonymous.json().plans).toEqual(plans);
    expect(plans.map((p: { id: string }) => p.id)).toEqual([
      "free",
      "basic",
      "pro",
    ]);
    expect(plans[1]).toEqual({
      id: "basic",
      name: "Basic",
      prices: {
        BRL: { month: 1490, year: 14900 },
        USD: { month: 499, year: 4990 },
      },
      limits: {
        aiReviewsPerDay: null,
        liveAiMatchesPerDay: 1,
        uploadsPerDay: 5,
        retentionDaysMax: 90,
        monthlyCredits: 15,
      },
      features: {
        clipExport: true,
        perMapLearning: false,
        cheaperDeep: false,
        monthlyReport: false,
        reel: false,
        deepHistory: false,
        priorityQueue: false,
        personalCoach: false,
      },
      credits: { monthly: 15, quickCost: 1, deepCost: 3 },
      benefits: ["clipExport"],
    });
    expect(plans[2]).toMatchObject({
      id: "pro",
      credits: { monthly: 45, quickCost: 1, deepCost: 2 },
      benefits: [
        "clipExport",
        "perMapLearning",
        "cheaperDeep",
        "monthlyReport",
        "reel",
        "deepHistory",
        "priorityQueue",
        "personalCoach",
      ],
    });
    const me = (await app.inject({ url: "/v1/me", headers: user })).json();
    expect(me.plan).toMatchObject({
      id: "free",
      status: "active",
      source: "default",
      features: { clipExport: false, perMapLearning: false },
    });
    expect(me.credits).toEqual({
      balance: 0,
      buckets: { plan: 0, bonus: 0, purchased: 0 },
      // Seeded dev accounts never signed in through Steam.
      welcome: { status: "ineligible", reason: "not_steam" },
      costs: { quick: 1, deep: 3 },
    });
    expect(me.usage).toEqual({
      day: "2026-10-19",
      resetsAt: "2026-10-20T03:00:00.000Z",
      // The per-account daily safety cap (credits are the main limit).
      aiReviews: { used: 0, limit: 30 },
      liveAiMatches: { used: 0, limit: 0 },
      uploads: { used: 0, limit: 2 },
    });
    const bossMe = (await app.inject({ url: "/v1/me", headers: boss })).json();
    expect(bossMe.plan).toMatchObject({ id: "admin", source: "role" });
    expect(bossMe.usage.uploads.limit).toBeNull();
    expect((await effectivePlan(repo, "user")).features.perMapLearning).toBe(
      false,
    );
  });

  it("limits uploads and sample imports per local day and resets at São Paulo midnight", async () => {
    now = Date.parse("2026-10-19T02:30:00Z"); // 23:30 on the 18th in São Paulo
    expect((await upload()).statusCode).toBe(202);
    await repo.pool.query("delete from demo_jobs"); // keep the active-job quota out of the way
    const sample = resolve(directory, "..", `sample-${randomUUID()}.dem`);
    await writeFile(sample, "sample");
    process.env.SAMPLE_DEMO_FILE = sample;
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/demos/sample",
          headers: user,
        })
      ).statusCode,
    ).toBe(202);
    await repo.pool.query("delete from demo_jobs");
    const limited = await upload();
    expect(limited.statusCode).toBe(402);
    expect(limited.json()).toEqual({
      error: expect.any(String),
      code: "plan_limit",
      feature: "uploads",
      limit: 2,
      resetsAt: "2026-10-19T03:00:00.000Z",
      upgradeTo: "basic",
    });
    const sampleLimited = await app.inject({
      method: "POST",
      url: "/v1/demos/sample",
      headers: user,
    });
    expect(sampleLimited.statusCode).toBe(402);
    now = Date.parse("2026-10-19T03:00:01Z");
    expect((await upload()).statusCode).toBe(202);
    // Admins are unlimited.
    for (let i = 0; i < 4; i++) {
      await repo.pool.query("delete from demo_jobs where owner_id='boss'");
      expect((await upload(boss)).statusCode).toBe(202);
    }
    delete process.env.SAMPLE_DEMO_FILE;
    await rm(sample, { force: true });
  });

  it("counts only successful AI reviews and gates live AI by plan", async () => {
    const { id, steamId } = await analysisFor("user");
    const review = () =>
      app.inject({
        method: "POST",
        url: `/v1/analyses/${id}/coaching`,
        headers: user,
        payload: { steamId },
      });
    // Free accounts start without credits: 402 with the price, packs and upgrade path.
    const broke = await review();
    expect(broke.statusCode).toBe(402);
    expect(broke.json()).toMatchObject({
      code: "insufficient_credits",
      tier: "quick",
      needed: 1,
      balance: 0,
      upgradeTo: "basic",
      packs: [
        { id: "starter", credits: 10, prices: { BRL: 990, USD: 299 } },
        { id: "standard", credits: 30 },
        { id: "pro-pack", credits: 100 },
      ],
    });
    expect(hits).toBe(0);
    const granted = await app.inject({
      method: "POST",
      url: "/v1/admin/users/user/credits",
      headers: boss,
      payload: { delta: 1, note: "test" },
    });
    expect(granted.statusCode).toBe(200);
    expect(granted.json().credits.balance).toBe(1);
    mode = "error";
    expect((await review()).statusCode).toBe(502);
    mode = "ok";
    const ok = await review();
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({
      tier: "quick",
      creditsSpent: 1,
      balance: 0,
    });
    const limited = await review();
    expect(limited.statusCode).toBe(402);
    expect(limited.json()).toMatchObject({
      code: "insufficient_credits",
      balance: 0,
    });
    expect(hits).toBe(2);
    // The per-account daily safety cap still applies whatever the balance.
    await app.inject({
      method: "PUT",
      url: "/v1/admin/credits/settings",
      headers: boss,
      payload: { dailySafetyCap: 1 },
    });
    await app.inject({
      method: "POST",
      url: "/v1/admin/users/user/credits",
      headers: boss,
      payload: { delta: 5, note: "cap test" },
    });
    const capped = await review();
    expect(capped.statusCode).toBe(402);
    expect(capped.json()).toMatchObject({
      code: "plan_limit",
      feature: "ai_review",
      limit: 1,
      upgradeTo: null,
    });
    await app.inject({
      method: "PUT",
      url: "/v1/admin/credits/settings",
      headers: boss,
      payload: { dailySafetyCap: 30 },
    });
    const live = (payload: Record<string, unknown>) =>
      app.inject({
        method: "POST",
        url: "/v1/ai/live-call",
        headers: user,
        payload: {
          state: { map: "de_mirage", phase: "freezetime", round: 2 },
          recentRounds: [{ round: 1, kills: 0, died: true }],
          ...payload,
        },
      });
    const free = await live({});
    expect(free.statusCode).toBe(402);
    expect(free.json()).toMatchObject({ feature: "live_ai", limit: 0 });
    expect(hits).toBe(2);
    await app.inject({
      method: "PUT",
      url: "/v1/admin/users/user/plan",
      headers: boss,
      payload: { planId: "basic" },
    });
    expect((await live({ analysisId: id })).statusCode).toBe(200);
    expect((await live({ analysisId: id })).statusCode).toBe(200); // same match: free
    const second = await live({ analysisId: randomUUID() });
    expect(second.statusCode).toBe(402);
    expect(second.json()).toMatchObject({
      feature: "live_ai",
      limit: 1,
      upgradeTo: "pro",
    });
    const me = (await app.inject({ url: "/v1/me", headers: user })).json();
    expect(me.usage.liveAiMatches).toEqual({ used: 1, limit: 1 });
    expect(me.usage.aiReviews).toEqual({ used: 1, limit: 30 });
    // The admin grant of Basic also granted this period's 15 plan credits.
    expect(me.credits.buckets).toEqual({ plan: 15, bonus: 5, purchased: 0 });
    expect(me.credits.planExpiresAt).toBe("2026-11-01T03:00:00.000Z");
  });

  it("reserves atomically under concurrency", async () => {
    const usage = new PgUsageRepository(repo.db);
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        usage.reserve("user", "2026-10-19", "ai_review", 3),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(3);
    expect(await usage.used("user", "2026-10-19", "ai_review")).toBe(3);
    const live = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        usage.reserveLive("user", "2026-10-19", `m${i}`, 2, 40),
      ),
    );
    expect(live.filter((r) => r === "ok")).toHaveLength(2);
    expect(await usage.liveMatches("user", "2026-10-19")).toBe(2);
    // Parallel uploads through HTTP never exceed the plan.
    const responses = await Promise.all(
      Array.from({ length: 4 }, () => upload()),
    );
    expect(
      responses.filter((r) => r.statusCode === 402).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      responses.filter((r) => r.statusCode === 202).length,
    ).toBeLessThanOrEqual(2);
  });

  it("lets admins edit plans and grant plans; clamps retention to the plan", async () => {
    expect(
      (await app.inject({ url: "/v1/admin/plans", headers: user })).statusCode,
    ).toBe(403);
    const plans = (
      await app.inject({ url: "/v1/admin/plans", headers: boss })
    ).json().plans;
    expect(plans[0]).toMatchObject({
      id: "free",
      active: true,
      stripePrices: {},
    });
    const edited = await app.inject({
      method: "PUT",
      url: "/v1/admin/plans/free",
      headers: boss,
      payload: { limits: { uploadsPerDay: 3 }, prices: {} },
    });
    expect(edited.statusCode).toBe(200);
    expect(edited.json().limits.uploadsPerDay).toBe(3);
    for (const [payload, status] of [
      [{ limits: { uploadsPerDay: -1 } }, 400],
      [{ unknown: 1 }, 400],
      [{ active: false }, 400],
    ] as const)
      expect(
        (
          await app.inject({
            method: "PUT",
            url: "/v1/admin/plans/free",
            headers: boss,
            payload,
          })
        ).statusCode,
      ).toBe(status);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/v1/admin/plans",
          headers: boss,
          payload: { id: "nope", name: "x" },
        })
      ).statusCode,
    ).toBe(404);
    await app.inject({
      method: "PUT",
      url: "/v1/admin/plans",
      headers: boss,
      payload: {
        id: "basic",
        active: false,
        stripePrices: { BRL_month: "price_x1" },
      },
    });
    expect(
      (await app.inject({ url: "/v1/plans", headers: user }))
        .json()
        .plans.map((p: { id: string }) => p.id),
    ).toEqual(["free", "pro"]);
    // Upgrade suggestions skip inactive plans.
    for (let i = 0; i < 3; i++) {
      expect((await upload()).statusCode).toBe(202);
      await repo.pool.query("delete from demo_jobs");
    }
    expect((await upload()).json().upgradeTo).toBe("pro");
    await app.inject({
      method: "PUT",
      url: "/v1/admin/plans/basic",
      headers: boss,
      payload: { active: true, stripePrices: {} },
    });
    await app.inject({
      method: "PUT",
      url: "/v1/admin/plans/free",
      headers: boss,
      payload: { limits: { uploadsPerDay: 2 } },
    });

    const settings = {
      telemetryConsent: true,
      analyticsConsent: false,
      retentionDays: 365,
    };
    const put = () =>
      app.inject({
        method: "PUT",
        url: "/v1/settings",
        headers: user,
        payload: settings,
      });
    expect((await put()).json().retentionDays).toBe(30);
    const grant = await app.inject({
      method: "PUT",
      url: "/v1/admin/users/user/plan",
      headers: boss,
      payload: { planId: "pro", until: "2026-12-01T00:00:00Z" },
    });
    expect(grant.statusCode).toBe(200);
    expect(grant.json()).toEqual({
      userId: "user",
      plan: expect.objectContaining({
        id: "pro",
        source: "admin",
        status: "active",
        renewsAt: "2026-12-01T00:00:00.000Z",
      }),
    });
    expect((await put()).json().retentionDays).toBe(365);
    const users = (
      await app.inject({ url: "/v1/admin/users", headers: boss })
    ).json().users;
    expect(
      users.find((u: { id: string }) => u.id === "user").plan,
    ).toMatchObject({
      id: "pro",
      source: "admin",
    });
    await app.inject({
      method: "PUT",
      url: "/v1/admin/users/user/plan",
      headers: boss,
      payload: { planId: "basic" },
    });
    expect((await repo.settings("user")).retentionDays).toBe(90);
    for (const [url, payload, status] of [
      ["/v1/admin/users/user/plan", { planId: "nope" }, 404],
      ["/v1/admin/users/nobody/plan", { planId: "pro" }, 404],
      [
        "/v1/admin/users/user/plan",
        { planId: "pro", until: "2020-01-01T00:00:00Z" },
        400,
      ],
      ["/v1/admin/users/user/plan", { plan: "pro" }, 400],
    ] as const)
      expect(
        (await app.inject({ method: "PUT", url, headers: boss, payload }))
          .statusCode,
      ).toBe(status);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/v1/admin/users/user/plan",
          headers: user,
          payload: { planId: "pro" },
        })
      ).statusCode,
    ).toBe(403);
    const audit = await repo.pool.query(
      "select action from admin_audit where action in ('plan.update','user.plan')",
    );
    expect(audit.rows.length).toBeGreaterThanOrEqual(4);
  });

  it("reports billing disabled without Stripe configuration", async () => {
    expect(
      (await app.inject({ url: "/v1/billing/status", headers: user })).json(),
    ).toEqual({ enabled: false });
    const checkout = await app.inject({
      method: "POST",
      url: "/v1/billing/checkout",
      headers: user,
      payload: { planId: "basic", interval: "month", currency: "BRL" },
    });
    expect(checkout.statusCode).toBe(503);
    expect(checkout.json().code).toBe("billing_disabled");
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/billing/webhook",
          headers: { "content-type": "application/json" },
          payload: "{}",
        })
      ).statusCode,
    ).toBe(503);
  });

  it("creates Stripe checkouts and applies signed webhooks idempotently", async () => {
    expect(
      (
        await billingApp.inject({ url: "/v1/billing/status", headers: user })
      ).json(),
    ).toMatchObject({ enabled: true, provider: "stripe" });
    expect(
      (
        await billingApp.inject({
          method: "POST",
          url: "/v1/billing/checkout",
          headers: user,
          payload: { planId: "basic", interval: "year", currency: "USD" },
        })
      ).statusCode,
    ).toBe(400); // no yearly price configured
    const checkout = await billingApp.inject({
      method: "POST",
      url: "/v1/billing/checkout",
      headers: user,
      payload: { planId: "basic", interval: "month", currency: "BRL" },
    });
    expect(checkout.json()).toEqual({ url: "https://checkout.stripe.test/s" });
    const call = stripeCalls.at(-1)!;
    expect(call.url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(call.auth).toBe("Bearer sk_test_integration"); // gitleaks:allow (fake test value)
    const form = new URLSearchParams(call.body);
    expect(form.get("mode")).toBe("subscription");
    expect(form.get("line_items[0][price]")).toBe("price_basicmonthly");
    expect(form.get("client_reference_id")).toBe("user");
    expect(form.get("payment_method_types[0]")).toBe("card");
    expect(form.get("success_url")).toBe(
      "https://app.example/billing?status=success",
    );

    const deliver = (event: Record<string, unknown>, signature?: string) => {
      const raw = JSON.stringify(event);
      return billingApp.inject({
        method: "POST",
        url: "/v1/billing/webhook",
        headers: {
          "content-type": "application/json",
          "stripe-signature":
            signature ?? signStripePayload(raw, WEBHOOK_SECRET),
        },
        payload: raw,
      });
    };
    const completed = {
      id: "evt_a",
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          client_reference_id: "user",
          customer: "cus_1",
          subscription: "sub_1",
          metadata: { ownerId: "user", planId: "basic" },
        },
      },
    };
    expect(
      (await deliver(completed, "t=1,v1=" + "a".repeat(64))).statusCode,
    ).toBe(400);
    expect(
      (
        await deliver(
          completed,
          signStripePayload(
            JSON.stringify(completed),
            WEBHOOK_SECRET,
            Math.floor(Date.now() / 1000) - 3600,
          ),
        )
      ).statusCode,
    ).toBe(400);
    expect((await deliver(completed)).json()).toEqual({
      received: true,
      duplicate: false,
    });
    expect((await deliver(completed)).json()).toEqual({
      received: true,
      duplicate: true,
    });
    let me = (await billingApp.inject({ url: "/v1/me", headers: user })).json();
    expect(me.plan).toMatchObject({
      id: "basic",
      source: "stripe",
      status: "active",
    });
    await deliver({
      id: "evt_b",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_1",
          customer: "cus_1",
          status: "active",
          metadata: { ownerId: "user", planId: "pro" },
          items: { data: [{ current_period_end: 1_900_000_000 }] },
        },
      },
    });
    me = (await billingApp.inject({ url: "/v1/me", headers: user })).json();
    expect(me.plan).toMatchObject({
      id: "pro",
      renewsAt: new Date(1_900_000_000_000).toISOString(),
    });
    await deliver({
      id: "evt_c",
      type: "invoice.payment_failed",
      data: { object: { subscription: "sub_1", customer: "cus_1" } },
    });
    me = (await billingApp.inject({ url: "/v1/me", headers: user })).json();
    expect(me.plan).toMatchObject({ id: "pro", status: "past_due" });
    const portal = await billingApp.inject({
      method: "POST",
      url: "/v1/billing/portal",
      headers: user,
    });
    expect(portal.json().url).toBe("https://checkout.stripe.test/s");
    expect(new URLSearchParams(stripeCalls.at(-1)!.body).get("customer")).toBe(
      "cus_1",
    );
    await deliver({
      id: "evt_d",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_1", customer: "cus_1", status: "canceled" } },
    });
    me = (await billingApp.inject({ url: "/v1/me", headers: user })).json();
    expect(me.plan).toMatchObject({ id: "free", source: "default" });
    expect(
      (await repo.pool.query("select count(*)::int as n from billing_events"))
        .rows[0].n,
    ).toBe(4);
  });
});
