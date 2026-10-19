import { unwrapData } from "@cs2/coaching";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Pool } from "pg";
import type { FastifyInstance } from "fastify";
import { analyzeDemo } from "@cs2/analytics";
import { generateCoaching } from "@cs2/coaching";
import { buildHttpApp } from "../src/app.js";
import { createContainer, type Container } from "../src/container.js";
import { RuntimeEnv } from "../src/config/env.js";
import { ZonedClock } from "../src/shared/clock/clock.js";
import {
  signStripePayload,
  StripePaymentGateway,
} from "../src/infrastructure/billing/stripe-payment-gateway.js";
import { TestDatabase } from "./support/test-database.js";

const databaseUrl = process.env.DATABASE_URL;
const WEBHOOK = "whsec_credits";
const DAY = 86_400_000;

/**
 * Credits end to end over Postgres: wallet + ledger reconciliation, reserve → commit/release
 * around AI reviews (including parallel requests), review tiers, packs via Stripe Checkout,
 * plan period grants and expiry, welcome credits with anti-farm rules, reel and reports.
 */
describe.skipIf(!databaseUrl)(
  "credits, tiers, welcome and reports (Postgres)",
  () => {
    let admin: Pool;
    let repo: TestDatabase;
    let app: FastifyInstance;
    let container: Container;
    let server: Server;
    let directory: string;
    let now = Date.parse("2026-10-19T15:00:00Z");
    let mode: "ok" | "error" | "slow" = "ok";
    let hits = 0;
    let xml = "";
    const stripe: { url: string; body: string }[] = [];
    const schema = "credits_" + randomUUID().replaceAll("-", "");
    const user = { authorization: "Bearer user-token" };
    const pro = { authorization: "Bearer pro-token" };
    const boss = { authorization: "Bearer boss-token" };
    const env: Record<string, string | undefined> = {};

    const memberSince = (daysAgo: number) =>
      new Date(now - daysAgo * DAY).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
    const profileXml = (steamId: string, over: Record<string, string> = {}) => {
      const v = {
        steamID64: steamId,
        steamID: "<![CDATA[Player]]>",
        privacyState: "public",
        vacBanned: "0",
        memberSince: memberSince(400),
        ...over,
      };
      return `<?xml version="1.0" encoding="UTF-8"?><profile>${Object.entries(v)
        .map(([k, x]) => `<${k}>${x}</${k}>`)
        .join("")}</profile>`;
    };
    const steamFetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "https://steamcommunity.com/openid/login")
        return new Response(
          "ns:http://specs.openid.net/auth/2.0\nis_valid:true\n",
        );
      const id = /profiles\/(\d+)\//.exec(url)?.[1];
      if (id) return new Response(xml.replace(/STEAMID/g, id));
      throw new Error("unexpected fetch " + url);
    }) as typeof fetch;

    async function steamSignIn(steamId: string, ip = "203.0.113.7") {
      const started = await app.inject({ url: "/v1/auth/steam/start" });
      const returned = new URL(started.json().url).searchParams.get(
        "openid.return_to",
      )!;
      const state = new URL(returned).searchParams.get("state")!;
      const parameters = new URLSearchParams({
        state,
        "openid.ns": "http://specs.openid.net/auth/2.0",
        "openid.mode": "id_res",
        "openid.op_endpoint": "https://steamcommunity.com/openid/login",
        "openid.return_to": returned,
        "openid.claimed_id": `https://steamcommunity.com/openid/id/${steamId}`,
        "openid.identity": `https://steamcommunity.com/openid/id/${steamId}`,
        "openid.response_nonce":
          new Date().toISOString().slice(0, 19) + "Z" + randomUUID(),
        "openid.signed":
          "op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle",
        "openid.assoc_handle": "handle",
        "openid.sig": "signature",
      });
      const verified = await app.inject({
        url: "/v1/auth/steam/callback?" + parameters,
        headers: { cookie: `cs2_steam_state=${state}` },
        remoteAddress: ip,
      });
      expect(verified.statusCode).toBe(302);
      const code = new URL(verified.headers.location!).searchParams.get("code");
      const binding = (verified.headers["set-cookie"] as string[])
        .find((c) => c.startsWith("cs2_steam_exchange="))!
        .split(";")[0]!;
      const exchange = await app.inject({
        method: "POST",
        url: "/v1/auth/exchange",
        headers: { cookie: binding },
        payload: { code },
      });
      const headers = {
        authorization: `Bearer ${exchange.json().token as string}`,
      };
      const ownerId = (await app.inject({ url: "/v1/me", headers })).json()
        .ownerId as string;
      return { headers, ownerId };
    }
    const me = async (headers: Record<string, string>) =>
      (await app.inject({ url: "/v1/me", headers })).json();
    /** Waits for the background welcome evaluation of a sign-in. */
    async function welcomeOf(headers: Record<string, string>) {
      for (let i = 0; i < 50; i++) {
        const w = (await me(headers)).credits.welcome;
        if (w.reason !== "not_evaluated") return w;
        await new Promise((r) => setTimeout(r, 20));
      }
      return (await me(headers)).credits.welcome;
    }
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
              "../../../packages/contracts/fixtures/normalized-demo-enriched.json",
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
    const review = (
      headers: Record<string, string>,
      id: string,
      steamId: string,
      tier?: string,
    ) =>
      app.inject({
        method: "POST",
        url: `/v1/analyses/${id}/coaching`,
        headers,
        payload: { steamId, ...(tier ? { tier } : {}) },
      });
    const reconcile = async (ownerId: string) => {
      const ledger = await repo.credits.ledgerTotals(ownerId);
      const wallet = (await repo.credits.wallet(ownerId, new Date(0))).balances;
      expect(ledger).toEqual(wallet);
      return wallet;
    };
    const webhook = (event: Record<string, unknown>) => {
      const raw = JSON.stringify(event);
      return app.inject({
        method: "POST",
        url: "/v1/billing/webhook",
        headers: {
          "content-type": "application/json",
          "stripe-signature": signStripePayload(
            raw,
            WEBHOOK,
            Math.floor(now / 1000),
          ),
        },
        payload: raw,
      });
    };

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
      await repo.seedDev("pro", "pro-token", "pro-device", "pro-device-token");
      await repo.seedDev(
        "boss",
        "boss-token",
        "boss-device",
        "boss-device-token",
      );
      await repo.pool.query("update users set role='admin' where id='boss'");
      directory = await mkdtemp(resolve(tmpdir(), "cs2-credits-"));
      server = createServer((req, res) => {
        let raw = "";
        req.on("data", (c) => (raw += c));
        req.on("end", async () => {
          if (raw.includes("fact checker of this app")) {
            // The claim verifier (purpose verify): supports nothing new, changes nothing.
            res.writeHead(200, { "content-type": "application/json" });
            return res.end(
              JSON.stringify({
                choices: [
                  {
                    finish_reason: "stop",
                    message: { content: JSON.stringify({ results: [] }) },
                  },
                ],
              }),
            );
          }
          hits++;
          if (mode === "slow") await new Promise((r) => setTimeout(r, 150));
          if (mode === "error") {
            res.writeHead(500, { "content-type": "application/json" });
            return res.end(JSON.stringify({ error: { message: "boom" } }));
          }
          const body = JSON.parse(raw) as { messages: { content: string }[] };
          const userMsg = body.messages[1]!.content;
          const data = unwrapData(userMsg) as {
            facts?: { id: string }[];
            trends?: unknown;
            basedOnMatches?: number;
          };
          const coachPlan =
            data.basedOnMatches !== undefined
              ? {
                  headline: "Trade more, peek less",
                  workingWell: [
                    { text: "Good ADR", evidence: [data.facts![0]!.id] },
                  ],
                  notWorking: [{ text: "Invented", evidence: ["not-a-fact"] }],
                  focusAreas: [
                    {
                      area: "Trading",
                      why: "w",
                      targetMetric: data.facts![0]!.id,
                      target: 99,
                    },
                  ],
                  weeklyProgram: [
                    {
                      week: 1,
                      goals: ["g"],
                      drills: [{ name: "d", minutesPerDay: 15, howTo: "h" }],
                    },
                  ],
                  perMap: [],
                  nextReviewSuggestion: "Deep review next.",
                }
              : undefined;
          const content = coachPlan
            ? coachPlan
            : data.trends
              ? {
                  headline: "Solid month",
                  summary: "S.",
                  strengths: ["A"],
                  focus: ["B"],
                  plan: ["C"],
                }
              : {
                  verdict: "V",
                  summary: "Mock.",
                  insights: [
                    {
                      observation: "x",
                      evidenceIds: [
                        data.facts!.find((f) => f.id.startsWith("deep-"))?.id ??
                          data.facts![0]!.id,
                      ],
                      confidence: "low",
                      actionablePractice: "y",
                      caveats: [],
                      kind: "improve",
                      scope: "general",
                    },
                  ],
                  keyMoments: [],
                  drills: [],
                  plan: [{ text: "z", scope: "general" }],
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
      Object.assign(env, {
        AI_PROVIDER: "local-mock",
        AI_BASE_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
        AI_API_KEY: "sk-test",
        AI_MODEL: "mock",
        AI_MAX_ATTEMPTS: "1",
        APP_ENCRYPTION_KEY: "credits-test-key",
      });
      container = createContainer({
        database: repo,
        devices: [],
        owners: [],
        webOrigin: "https://app.example",
        apiPublicUrl: "http://127.0.0.1:4000",
        jobs: {
          storageDir: directory,
          parserBin: process.execPath,
          disableWorker: true,
        },
        clock: new ZonedClock("America/Sao_Paulo", () => now),
        env: new RuntimeEnv(() => env),
        steamFetch,
        paymentGateway: new StripePaymentGateway(
          "sk_test_credits", // gitleaks:allow (fake test value)
          WEBHOOK,
          (async (input: string | URL | Request, init?: RequestInit) => {
            stripe.push({ url: String(input), body: String(init?.body) });
            return Response.json({ url: "https://checkout.stripe.test/once" });
          }) as typeof fetch,
          () => now,
        ),
      });
      app = await buildHttpApp(container);
    });
    /** The hourly account jobs (plan credits, scheduled reports). */
    const dailyJobs = () => container.jobs!.daily.run();
    beforeEach(async () => {
      now = Date.parse("2026-10-19T15:00:00Z");
      mode = "ok";
      hits = 0;
      xml = profileXml("STEAMID");
      for (const t of [
        "usage_counters",
        "provider_usage",
        "credit_holds",
        "credit_ledger",
        "credit_wallets",
        "subscriptions",
        "reports",
        "personal_coach_plans",
        "demo_jobs",
        "billing_events",
      ])
        await repo.pool.query(`delete from ${t}`);
    });
    afterAll(async () => {
      await app?.close();
      await new Promise((r) => server?.close(r));
      await repo?.close();
      if (directory) await rm(directory, { recursive: true, force: true });
      if (admin) {
        await admin.query(`drop schema ${schema} cascade`);
        await admin.end();
      }
    });

    it("parallel reviews cannot double-spend; failures release; the ledger reconciles", async () => {
      const { id, steamId } = await analysisFor("user");
      await repo.grantCredits("user", 2);
      mode = "slow";
      const results = await Promise.all(
        Array.from({ length: 6 }, () => review(user, id, steamId)),
      );
      const codes = results.map((r) => r.statusCode).sort();
      expect(codes).toEqual([200, 200, 402, 402, 402, 402]);
      // Only the two funded requests reached the model.
      expect(hits).toBe(2);
      expect(results.find((r) => r.statusCode === 402)!.json()).toMatchObject({
        code: "insufficient_credits",
        needed: 1,
      });
      expect(await reconcile("user")).toEqual({
        plan: 0,
        bonus: 0,
        purchased: 0,
      });
      await repo.grantCredits("user", 1);
      mode = "error";
      expect((await review(user, id, steamId)).statusCode).toBe(502);
      expect(await reconcile("user")).toEqual({
        plan: 0,
        bonus: 1,
        purchased: 0,
      });
      const ledger = (
        await app.inject({ url: "/v1/credits/ledger?limit=10", headers: user })
      ).json().entries;
      expect(
        ledger.filter((e: { reason: string }) => e.reason === "review_quick"),
      ).toHaveLength(2);
      expect(ledger[0]).toMatchObject({
        reason: "admin_adjust",
        delta: 1,
        bucket: "bonus",
      });
      expect(
        (await app.inject({ url: "/v1/credits/ledger?limit=0", headers: user }))
          .statusCode,
      ).toBe(400);
    });

    it("deep reviews cost 3 (2 on Pro), list per tier and need credits; the reel is Pro", async () => {
      const { id, steamId } = await analysisFor("user");
      await repo.grantCredits("user", 3);
      const deep = await review(user, id, steamId, "deep");
      expect(deep.statusCode).toBe(200);
      expect(deep.json()).toMatchObject({
        tier: "deep",
        creditsSpent: 3,
        balance: 0,
      });
      expect(deep.json().coaching).toMatchObject({
        tier: "deep",
        provenance: { promptVersion: "igl-review-v9-deep" },
      });
      expect(deep.json().coaching.deep.utility).toBeDefined();
      expect(deep.json().coaching.insights[0].evidenceIds[0]).toMatch(/^deep-/);
      const quick = await review(user, id, steamId, "quick");
      expect(quick.statusCode).toBe(402);
      expect(quick.json()).toMatchObject({
        tier: "quick",
        needed: 1,
        balance: 0,
        upgradeTo: "basic",
      });
      const listed = await app.inject({
        url: `/v1/analyses/${id}/reviews?steamId=${steamId}`,
        headers: user,
      });
      expect(listed.statusCode).toBe(200);
      expect(listed.json()).toMatchObject({
        analysisId: id,
        steamId,
        latest: { quick: null, deep: deep.json().reviewId },
      });
      expect(listed.json().reviews[0]).toMatchObject({
        tier: "deep",
        creditsSpent: 3,
      });
      expect(
        listed.json().reviews[0].coaching.provenance.model,
      ).toBeUndefined();
      expect(
        (await app.inject({ url: `/v1/analyses/${id}/reviews`, headers: user }))
          .statusCode,
      ).toBe(400);
      const reel = await app.inject({
        url: `/v1/analyses/${id}/reel?steamId=${steamId}`,
        headers: user,
      });
      expect(reel.statusCode).toBe(402);
      expect(reel.json()).toMatchObject({
        code: "plan_feature",
        feature: "reel",
        upgradeTo: "pro",
      });
      // Pro: deep costs 2 and the reel opens.
      await repo.pool.query(
        "insert into subscriptions(owner_id,plan_id,status,source) values('pro','pro','active','admin')",
      );
      const proMatch = await analysisFor("pro");
      await repo.grantCredits("pro", 2);
      const proDeep = await review(pro, proMatch.id, proMatch.steamId, "deep");
      expect(proDeep.json()).toMatchObject({ creditsSpent: 2, balance: 0 });
      const proReel = await app.inject({
        url: `/v1/analyses/${proMatch.id}/reel?steamId=${proMatch.steamId}`,
        headers: pro,
      });
      expect(proReel.statusCode).toBe(200);
      expect(proReel.json()).toMatchObject({
        analysisId: proMatch.id,
        steamId: proMatch.steamId,
      });
      expect(proReel.json().clips.length).toBeGreaterThan(0);
      expect((await me(pro)).credits.costs).toEqual({
        quick: 1,
        deep: 2,
        team: 3,
      });
    });

    it("grants plan credits per period (idempotent), expires leftovers and syncs on admin grants", async () => {
      const granted = await app.inject({
        method: "PUT",
        url: "/v1/admin/users/user/plan",
        headers: boss,
        payload: { planId: "basic" },
      });
      expect(granted.statusCode).toBe(200);
      let view = (await me(user)).credits;
      expect(view).toMatchObject({
        balance: 15,
        buckets: { plan: 15, bonus: 0, purchased: 0 },
        planExpiresAt: "2026-11-01T03:00:00.000Z",
      });
      await app.inject({
        method: "PUT",
        url: "/v1/admin/users/user/plan",
        headers: boss,
        payload: { planId: "basic" },
      });
      expect((await me(user)).credits.balance).toBe(15);
      // Upgrading mid-period replaces the plan bucket with the new plan's credits.
      await app.inject({
        method: "PUT",
        url: "/v1/admin/users/user/plan",
        headers: boss,
        payload: { planId: "pro" },
      });
      expect((await me(user)).credits.buckets.plan).toBe(45);
      // Next month: leftovers expire, the daily job grants the new period.
      now = Date.parse("2026-11-02T12:00:00Z");
      expect((await me(user)).credits.balance).toBe(0);
      await repo.grantCredits("user", 2);
      await dailyJobs();
      await dailyJobs();
      view = (await me(user)).credits;
      expect(view).toMatchObject({
        balance: 47,
        buckets: { plan: 45, bonus: 2, purchased: 0 },
        planExpiresAt: "2026-12-01T03:00:00.000Z",
      });
      const reasons = (await repo.credits.ledger("user", 50)).map(
        (e) => e.reason,
      );
      // Basic's leftovers on the upgrade, then October's Pro credits at the period end.
      expect(reasons.filter((r) => r === "expire")).toHaveLength(2);
      expect(reasons.filter((r) => r === "plan_grant")).toHaveLength(3);
      await reconcile("user");
    });

    it("buys credit packs through Stripe Checkout and applies the paid webhook once", async () => {
      const packs = (await app.inject({ url: "/v1/credits/packs" })).json()
        .packs;
      expect(packs).toEqual([
        {
          id: "starter",
          name: "Starter",
          credits: 10,
          prices: { BRL: 990, USD: 299 },
        },
        {
          id: "standard",
          name: "Standard",
          credits: 30,
          prices: { BRL: 2490, USD: 749 },
          badge: "popular",
        },
        {
          id: "pro-pack",
          name: "Pro pack",
          credits: 100,
          prices: { BRL: 6990, USD: 1999 },
          badge: "best_value",
        },
      ]);
      stripe.length = 0;
      const checkout = await app.inject({
        method: "POST",
        url: "/v1/billing/credits/checkout",
        headers: user,
        payload: { packId: "standard", currency: "USD" },
      });
      expect(checkout.statusCode).toBe(200);
      expect(checkout.json()).toEqual({
        url: "https://checkout.stripe.test/once",
      });
      const form = new URLSearchParams(stripe[0]!.body);
      expect(form.get("mode")).toBe("payment");
      expect(form.get("line_items[0][price_data][unit_amount]")).toBe("749");
      expect(form.get("line_items[0][price_data][currency]")).toBe("usd");
      expect(form.get("metadata[kind]")).toBe("credits");
      expect(form.get("metadata[packId]")).toBe("standard");
      expect(form.get("metadata[credits]")).toBe("30");
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/v1/billing/credits/checkout",
            headers: user,
            payload: { packId: "nope", currency: "USD" },
          })
        ).statusCode,
      ).toBe(404);
      const session = {
        id: "cs_test_1",
        mode: "payment",
        payment_status: "paid",
        client_reference_id: "user",
        metadata: {
          kind: "credits",
          packId: "standard",
          ownerId: "user",
          credits: "30",
        },
      };
      expect(
        (
          await webhook({
            id: "evt_1",
            type: "checkout.session.completed",
            data: { object: session },
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await webhook({
            id: "evt_1",
            type: "checkout.session.completed",
            data: { object: session },
          })
        ).json(),
      ).toMatchObject({ duplicate: true });
      // A different delivery id for the same session cannot credit twice (ledger idempotency).
      await webhook({
        id: "evt_2",
        type: "checkout.session.async_payment_succeeded",
        data: { object: session },
      });
      // Unpaid (async methods) sessions do not credit.
      await webhook({
        id: "evt_3",
        type: "checkout.session.completed",
        data: {
          object: { ...session, id: "cs_test_2", payment_status: "unpaid" },
        },
      });
      expect((await me(user)).credits.buckets).toEqual({
        plan: 0,
        bonus: 0,
        purchased: 30,
      });
      await reconcile("user");
    });

    it("invoice.paid grants the Stripe period's credits anchored on the period end", async () => {
      await repo.pool.query(
        "insert into subscriptions(owner_id,plan_id,status,source,stripe_customer_id,stripe_subscription_id) values('user','basic','active','stripe','cus_1','sub_1')",
      );
      const invoice = (end: number) => ({
        id: "in_" + end,
        customer: "cus_1",
        subscription: "sub_1",
        lines: { data: [{ period: { start: end - 30 * 86400, end } }] },
      });
      const end = Math.floor(Date.parse("2026-11-10T00:00:00Z") / 1000);
      expect(
        (
          await webhook({
            id: "evt_inv_1",
            type: "invoice.paid",
            data: { object: invoice(end) },
          })
        ).statusCode,
      ).toBe(200);
      expect((await me(user)).credits).toMatchObject({
        buckets: { plan: 15 },
        planExpiresAt: "2026-11-10T00:00:00.000Z",
      });
      await webhook({
        id: "evt_inv_2",
        type: "invoice.paid",
        data: { object: invoice(end) },
      });
      expect((await me(user)).credits.buckets.plan).toBe(15);
      const grants = (await repo.credits.ledger("user", 10)).filter(
        (e) => e.reason === "plan_grant",
      );
      expect(grants).toHaveLength(1);
      expect(grants[0]!.ref).toBe("period:basic:2026-10-10T00:00:00.000Z");
    });

    it("admin adjustments are audited, cannot go negative and show in the user ledger", async () => {
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/v1/admin/users/user/credits",
            headers: user,
            payload: { delta: 5, note: "x" },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/v1/admin/users/user/credits",
            headers: boss,
            payload: { delta: 0, note: "x" },
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/v1/admin/users/ghost/credits",
            headers: boss,
            payload: { delta: 1, note: "x" },
          })
        ).statusCode,
      ).toBe(404);
      const add = await app.inject({
        method: "POST",
        url: "/v1/admin/users/user/credits",
        headers: boss,
        payload: { delta: 4, note: "support", bucket: "purchased" },
      });
      expect(add.json()).toMatchObject({
        userId: "user",
        result: "ok",
        credits: {
          buckets: { purchased: 4 },
          welcome: { status: "ineligible", reason: "not_steam" },
        },
      });
      const over = await app.inject({
        method: "POST",
        url: "/v1/admin/users/user/credits",
        headers: boss,
        payload: { delta: -5, note: "too much", bucket: "purchased" },
      });
      expect(over.statusCode).toBe(400);
      expect(over.json().code).toBe("insufficient_credits");
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/v1/admin/users/user/credits",
            headers: boss,
            payload: { delta: -4, note: "undo", bucket: "purchased" },
          })
        ).statusCode,
      ).toBe(200);
      const ledger = (
        await app.inject({
          url: "/v1/admin/users/user/ledger?limit=5",
          headers: boss,
        })
      ).json();
      expect(ledger.userId).toBe("user");
      expect(
        ledger.entries.map((e: { delta: number; note?: string }) => [
          e.delta,
          e.note,
        ]),
      ).toEqual([
        [-4, "undo"],
        [4, "support"],
      ]);
      const audit = (
        await app.inject({ url: "/v1/admin/audit", headers: boss })
      ).json().entries;
      expect(
        audit.some((a: { action: string }) => a.action === "credits.adjust"),
      ).toBe(true);
      await reconcile("user");
    });

    it("admin credit settings and packs are editable and validated", async () => {
      expect(
        (
          await app.inject({ url: "/v1/admin/credits/settings", headers: boss })
        ).json().settings,
      ).toEqual({
        welcomeCredits: 1,
        quickCost: 1,
        deepCost: 3,
        proDeepCost: 2,
        teamCost: 4,
        proTeamCost: 3,
        dailySafetyCap: 30,
        minSteamAgeDays: 30,
        maxGrantsPerNetwork: 3,
        networkWindowDays: 30,
      });
      expect(
        (
          await app.inject({
            method: "PUT",
            url: "/v1/admin/credits/settings",
            headers: boss,
            payload: { quickCost: 0 },
          })
        ).statusCode,
      ).toBe(400);
      const put = await app.inject({
        method: "PUT",
        url: "/v1/admin/credits/settings",
        headers: boss,
        payload: { deepCost: 4 },
      });
      expect(put.json().settings.deepCost).toBe(4);
      expect((await me(user)).credits.costs).toEqual({
        quick: 1,
        deep: 4,
        team: 4,
      });
      expect(
        (await app.inject({ url: "/v1/plans" })).json().plans[1].credits
          .deepCost,
      ).toBe(4);
      await app.inject({
        method: "PUT",
        url: "/v1/admin/credits/settings",
        headers: boss,
        payload: { deepCost: 3 },
      });
      const packs = await app.inject({
        method: "PUT",
        url: "/v1/admin/credits/packs",
        headers: boss,
        payload: {
          packs: [
            {
              id: "mega",
              name: "Mega",
              credits: 500,
              prices: { BRL: 29900 },
              active: false,
              sort: 9,
            },
          ],
        },
      });
      expect(packs.statusCode).toBe(200);
      expect(
        packs.json().packs.find((p: { id: string }) => p.id === "mega"),
      ).toMatchObject({ active: false, credits: 500 });
      expect(
        (await app.inject({ url: "/v1/credits/packs" }))
          .json()
          .packs.map((p: { id: string }) => p.id),
      ).not.toContain("mega");
      expect(
        (
          await app.inject({
            method: "PUT",
            url: "/v1/admin/credits/packs",
            headers: boss,
            payload: {
              packs: [
                {
                  id: "Bad Id",
                  name: "x",
                  credits: 1,
                  prices: {},
                  active: true,
                  sort: 0,
                },
              ],
            },
          })
        ).statusCode,
      ).toBe(400);
    });

    it("welcome credits: once per Steam id ever, eligible profiles only, limited per network", async () => {
      xml = profileXml("STEAMID");
      const a = await steamSignIn("76561198000000201", "198.51.100.10");
      expect(await welcomeOf(a.headers)).toEqual({ status: "granted" });
      expect((await me(a.headers)).credits).toMatchObject({
        balance: 1,
        buckets: { bonus: 1 },
      });
      expect((await repo.credits.ledger(a.ownerId, 5))[0]).toMatchObject({
        reason: "welcome",
        delta: 1,
        bucket: "bonus",
        ref: "welcome",
      });
      // Signing in again never grants twice.
      await steamSignIn("76561198000000201", "198.51.100.10");
      expect((await me(a.headers)).credits.balance).toBe(1);
      // Deleting the account and coming back with the same Steam id: no new grant.
      expect(
        (
          await app.inject({
            method: "DELETE",
            url: "/v1/account",
            headers: a.headers,
          })
        ).statusCode,
      ).toBe(204);
      const stored = await repo.pool.query(
        "select steam_id_hash from welcome_grants",
      );
      expect(stored.rows.length).toBe(1);
      expect(stored.rows[0].steam_id_hash).not.toContain("76561198000000201");
      const again = await steamSignIn("76561198000000201", "198.51.100.10");
      expect(await welcomeOf(again.headers)).toEqual({
        status: "ineligible",
        reason: "already_claimed",
      });
      expect((await me(again.headers)).credits.balance).toBe(0);
      // Private profile: pending until it becomes public (re-evaluated on refresh).
      xml = profileXml("STEAMID", { privacyState: "private", memberSince: "" });
      const hidden = await steamSignIn("76561198000000202", "198.51.100.11");
      expect(await welcomeOf(hidden.headers)).toEqual({
        status: "pending",
        reason: "profile_private",
      });
      xml = profileXml("STEAMID");
      await app.inject({
        method: "POST",
        url: "/v1/me/refresh-profile",
        headers: hidden.headers,
      });
      let w = await welcomeOf(hidden.headers);
      for (let i = 0; i < 50 && w.status !== "granted"; i++) {
        await new Promise((r) => setTimeout(r, 20));
        w = (await me(hidden.headers)).credits.welcome;
      }
      expect(w).toEqual({ status: "granted" });
      // Young and banned accounts.
      xml = profileXml("STEAMID", { memberSince: memberSince(5) });
      const young = await steamSignIn("76561198000000203", "198.51.100.12");
      expect(await welcomeOf(young.headers)).toEqual({
        status: "ineligible",
        reason: "account_too_new",
      });
      xml = profileXml("STEAMID", { vacBanned: "1" });
      const banned = await steamSignIn("76561198000000204", "198.51.100.13");
      expect(await welcomeOf(banned.headers)).toEqual({
        status: "ineligible",
        reason: "banned",
      });
      // At most 3 grants per /24 in 30 days (198.51.100.x already has 2 grants).
      xml = profileXml("STEAMID");
      const third = await steamSignIn("76561198000000205", "198.51.100.99");
      expect(await welcomeOf(third.headers)).toEqual({ status: "granted" });
      const fourth = await steamSignIn("76561198000000206", "198.51.100.200");
      expect(await welcomeOf(fourth.headers)).toEqual({
        status: "ineligible",
        reason: "network_limit",
      });
      const elsewhere = await steamSignIn("76561198000000207", "192.0.2.1");
      expect(await welcomeOf(elsewhere.headers)).toEqual({ status: "granted" });
      // Dev/local accounts are never eligible.
      expect((await me(user)).credits.welcome).toEqual({
        status: "ineligible",
        reason: "not_steam",
      });
    });

    it("Pro monthly reports: on demand once per period, scheduled on the 1st, free users 402", async () => {
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/v1/reports/generate",
            headers: user,
          })
        ).json(),
      ).toMatchObject({ code: "plan_feature", feature: "monthly_report" });
      await repo.pool.query(
        "insert into subscriptions(owner_id,plan_id,status,source) values('pro','pro','active','admin')",
      );
      await repo.pool.query(
        "update coach_profiles set player_steam_id=null where owner_id='pro'",
      );
      const { steamId } = await analysisFor("pro");
      await app.inject({
        method: "PUT",
        url: "/v1/coach/profile",
        headers: pro,
        payload: { playerSteamId: steamId },
      });
      const generated = await app.inject({
        method: "POST",
        url: "/v1/reports/generate",
        headers: pro,
        payload: { lang: "en" },
      });
      expect(generated.statusCode).toBe(200);
      expect(generated.json()).toMatchObject({
        period: "2026-10",
        source: "on_demand",
        matches: 1,
        headline: "Solid month",
      });
      expect(generated.json().report.narrative.plan).toEqual(["C"]);
      expect(generated.json().provider).toBeUndefined();
      const again = await app.inject({
        method: "POST",
        url: "/v1/reports/generate",
        headers: pro,
      });
      expect(again.statusCode).toBe(409);
      expect(again.json()).toMatchObject({
        code: "report_exists",
        period: "2026-10",
      });
      const list = (
        await app.inject({ url: "/v1/reports", headers: pro })
      ).json().reports;
      expect(list).toHaveLength(1);
      expect(
        (
          await app.inject({ url: `/v1/reports/${list[0].id}`, headers: pro })
        ).json().report.matches,
      ).toBe(1);
      expect(
        (await app.inject({ url: `/v1/reports/${list[0].id}`, headers: user }))
          .statusCode,
      ).toBe(404);
      // The scheduled job writes last month's report on the 1st (once).
      now = Date.parse("2026-11-01T15:00:00Z");
      await dailyJobs();
      await dailyJobs();
      const reports = (
        await app.inject({ url: "/v1/reports", headers: pro })
      ).json().reports;
      expect(
        reports
          .map(
            (r: { period: string; source: string }) =>
              `${r.period}/${r.source}`,
          )
          .sort(),
      ).toEqual(["2026-10/on_demand", "2026-10/scheduled"]);
      // Later in the month nothing is scheduled.
      now = Date.parse("2026-11-15T15:00:00Z");
      await dailyJobs();
      expect(
        (await app.inject({ url: "/v1/reports", headers: pro })).json().reports,
      ).toHaveLength(2);
    });

    it("Personal Coach: Pro only (teaser for others), cooldown unless 3 new analyses, auto-regenerates", async () => {
      const free = await app.inject({
        url: "/v1/coach/personal",
        headers: user,
      });
      expect(free.statusCode).toBe(402);
      expect(free.json()).toMatchObject({
        code: "plan_required",
        feature: "personal_coach",
        upgradeTo: "pro",
        teaser: { analyzedMatches: 0, reviews: 0 },
      });
      await repo.pool.query(
        "insert into subscriptions(owner_id,plan_id,status,source) values('pro','pro','active','admin')",
      );
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/v1/coach/personal/generate",
            headers: pro,
          })
        ).json(),
      ).toMatchObject({ code: "not_enough_data" });
      const { steamId } = await analysisFor("pro");
      await app.inject({
        method: "PUT",
        url: "/v1/coach/profile",
        headers: pro,
        payload: { playerSteamId: steamId },
      });
      const before = hits;
      const made = await app.inject({
        method: "POST",
        url: "/v1/coach/personal/generate",
        headers: pro,
        payload: { lang: "en" },
      });
      expect(made.statusCode).toBe(200);
      expect(hits - before).toBe(1);
      const view = made.json();
      expect(view.latest.plan).toMatchObject({
        headline: "Trade more, peek less",
        promptVersion: "personal-coach-v2",
        basedOnMatches: 1,
      });
      expect(view.latest.plan.workingWell).toHaveLength(1);
      expect(view.latest.plan.notWorking).toHaveLength(0);
      const fact = view.latest.plan.facts.find(
        (f: { id: string }) =>
          f.id === view.latest.plan.focusAreas[0].targetMetric,
      );
      expect(view.latest.plan.focusAreas[0].current).toBe(fact.value);
      expect(view.latest.provider).toBeUndefined();
      expect(view).toMatchObject({
        analyzedMatches: 1,
        newMatchesSinceLast: 0,
        autoRegenerateAfterMatches: 3,
      });
      expect(view.nextAvailableAt).toBe("2026-10-26T15:00:00.000Z");
      expect((await me(pro)).credits.balance).toBe(0);
      const cooldown = await app.inject({
        method: "POST",
        url: "/v1/coach/personal/generate",
        headers: pro,
      });
      expect(cooldown.statusCode).toBe(429);
      expect(cooldown.json()).toMatchObject({
        code: "personal_coach_cooldown",
        newMatchesNeeded: 3,
      });
      // Three new analyses: the hourly job regenerates automatically.
      for (let i = 0; i < 3; i++) await analysisFor("pro");
      now += 3_600_000;
      await dailyJobs();
      const after = (
        await app.inject({ url: "/v1/coach/personal", headers: pro })
      ).json();
      expect(after.history).toHaveLength(2);
      expect(after.latest).toMatchObject({ trigger: "auto" });
      expect(after.latest.plan.basedOnMatches).toBe(4);
      // A week later manual regeneration opens again.
      now += 8 * DAY;
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/v1/coach/personal/generate",
            headers: pro,
          })
        ).statusCode,
      ).toBe(200);
    });
  },
);
