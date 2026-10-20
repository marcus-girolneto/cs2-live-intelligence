import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildHttpApp } from "../src/app.js";
import { RuntimeEnv } from "../src/config/env.js";
import {
  createContainer,
  createWorker,
  type Container,
} from "../src/container.js";
import { PUBLIC_OPERATIONS } from "../src/modules/public-api/openapi/document.js";
import { verifySignature } from "../src/modules/webhooks/webhook-signer.js";
import type { WorkerHandle } from "../src/workers/worker-scheduler.js";
import { LENIENT_UPLOAD_RATE } from "./support/demo-bytes.js";
import { testDatabaseUrl } from "./support/database-url.js";
import { startMockAi, startWebhookReceiver } from "./support/mock-servers.js";
import { TestDatabase } from "./support/test-database.js";

const databaseUrl = testDatabaseUrl();
const fixture = process.env.DEMO_FIXTURE;
const parserBin = process.env.DEMO_PARSER_BIN;
const session = { authorization: "Bearer owner-token" };
const ALL_SCOPES = [
  "matches:read",
  "matches:write",
  "analyses:read",
  "reviews:write",
  "progress:read",
  "account:read",
  "webhooks:manage",
];

/**
 * The public API end to end against Postgres, the real parser and the public fixture: key
 * creation on the session route, upload through /api/v1/demos (idempotent), processing, the
 * analysis, a review with a mock AI, a signed webhook delivered to a local server, scopes, rate
 * limits, CORS, revocation, and that every /api/v1 route is documented.
 */
describe.skipIf(!databaseUrl || !fixture || !parserBin)(
  "public API /api/v1 (Postgres)",
  () => {
    let admin: Pool;
    let repo: TestDatabase;
    let container: Container;
    let app: FastifyInstance;
    let worker: WorkerHandle;
    let directory: string;
    let ai: Awaited<ReturnType<typeof startMockAi>>;
    let hooks: Awaited<ReturnType<typeof startWebhookReceiver>>;
    let key = "";
    let demoId = "";
    let steamId = "";
    const schema = "public_api_" + randomUUID().replaceAll("-", "");
    const bearer = (k = key) => ({ authorization: `Bearer ${k}` });

    async function createKey(scopes: string[], token = session) {
      const r = await app.inject({
        method: "POST",
        url: "/v1/me/api-keys",
        headers: token,
        payload: { name: "test", scopes },
      });
      expect(r.statusCode).toBe(201);
      return r.json() as { id: string; key: string };
    }

    beforeAll(async () => {
      admin = new Pool({ connectionString: databaseUrl });
      await admin.query(`create schema ${schema}`);
      const url = new URL(databaseUrl!);
      url.searchParams.set("options", `-c search_path=${schema}`);
      repo = new TestDatabase(url.toString());
      await repo.migrate();
      await repo.seedDev("owner", "owner-token", "owner-device", "od-token");
      await repo.seedDev("other", "other-token", "other-device", "xd-token");
      directory = await mkdtemp(resolve(tmpdir(), "cs2-public-api-"));
      repo.storageDir = directory;
      ai = await startMockAi();
      hooks = await startWebhookReceiver();
      const env = new RuntimeEnv(() => ({
        WEB_TOKEN: "public-api-test-secret",
        AI_PROVIDER: "local-mock",
        AI_BASE_URL: ai.baseUrl,
        AI_API_KEY: "sk-test",
        AI_MODEL: "mock/qwen3",
      }));
      const options = {
        storageDir: directory,
        parserBin: parserBin!,
        disableWorker: true,
      };
      container = createContainer({
        database: repo,
        devices: [],
        owners: [],
        webOrigin: "http://127.0.0.1:3000",
        apiPublicUrl: "http://api.test",
        jobs: options,
        env,
        overrides: { uploadRate: LENIENT_UPLOAD_RATE },
        webhooks: { allowPrivateNetworks: true },
      });
      app = await buildHttpApp(container);
      worker = await createWorker(repo, options, env);
      await repo.pool.query(
        "insert into subscriptions(owner_id,plan_id,status,source) values('owner','pro','active','admin')",
      );
      await repo.updateSettings("owner", {
        telemetryConsent: true,
        analyticsConsent: false,
        retentionDays: 30,
      });
      await repo.grantCredits("owner", 20);
    });
    afterAll(async () => {
      await worker?.stop();
      await app?.close();
      await repo?.close();
      await new Promise((r) => ai?.server.close(r));
      await new Promise((r) => hooks?.server.close(r));
      if (directory) await rm(directory, { recursive: true, force: true });
      if (admin) {
        await admin.query(`drop schema ${schema} cascade`);
        await admin.end();
      }
    });

    it("creates a key on the session route, shows it once and lists only its prefix", async () => {
      const created = await createKey(ALL_SCOPES);
      key = created.key;
      expect(key).toMatch(/^fm_live_[0-9A-Za-z]{32}$/);
      const list = await app.inject({
        url: "/v1/me/api-keys",
        headers: session,
      });
      const body = list.json();
      expect(body.keys).toHaveLength(1);
      expect(body.keys[0]).toMatchObject({
        prefix: key.slice(0, 12),
        status: "active",
      });
      expect(JSON.stringify(body)).not.toContain(key);
      expect(body.docsUrl).toBe("http://api.test/api/docs");
      const stored = await repo.pool.query("select key_hash from api_keys");
      expect(stored.rows[0].key_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(stored.rows[0].key_hash).not.toContain(key.slice(8));
      // The public API never accepts a session token, and the session routes never accept a key.
      const withSession = await app.inject({
        url: "/api/v1/me",
        headers: session,
      });
      expect(withSession.statusCode).toBe(401);
      expect(withSession.json().error.code).toBe("invalid_api_key");
      expect(
        (await app.inject({ url: "/v1/me", headers: bearer() })).statusCode,
      ).toBe(401);
    });

    it("answers errors in one format with a request id, and CORS without credentials", async () => {
      const missing = await app.inject({ url: "/api/v1/demos" });
      expect(missing.statusCode).toBe(401);
      expect(missing.json()).toEqual({
        error: {
          code: "missing_api_key",
          message: expect.any(String),
          requestId: missing.headers["x-request-id"],
        },
      });
      expect(missing.headers["access-control-allow-origin"]).toBe("*");
      const preflight = await app.inject({
        method: "OPTIONS",
        url: "/api/v1/demos",
        headers: {
          origin: "https://tools.example",
          "access-control-request-method": "POST",
        },
      });
      expect(preflight.statusCode).toBe(204);
      expect(preflight.headers["access-control-allow-headers"]).toMatch(
        /Idempotency-Key/,
      );
      expect(
        preflight.headers["access-control-allow-credentials"],
      ).toBeUndefined();
      const unknown = await app.inject({
        url: "/api/v1/admin/users",
        headers: bearer(),
      });
      expect(unknown.statusCode).toBe(404);
      expect(unknown.json().error.code).toBe("not_found");
    });

    it("enforces scopes and audits the denial", async () => {
      const readOnly = await createKey(["matches:read"]);
      const denied = await app.inject({
        url: "/api/v1/me",
        headers: bearer(readOnly.key),
      });
      expect(denied.statusCode).toBe(403);
      expect(denied.json().error).toMatchObject({
        code: "insufficient_scope",
        details: { requiredScope: "account:read" },
      });
      const audit = await repo.pool.query(
        "select action,details from api_key_events where key_id=$1 order by created_at",
        [readOnly.id],
      );
      expect(audit.rows.map((r) => r.action)).toEqual([
        "key.created",
        "key.denied",
      ]);
      const ok = await app.inject({
        url: "/api/v1/demos",
        headers: bearer(readOnly.key),
      });
      expect(ok.statusCode).toBe(200);
      expect(ok.headers["ratelimit-limit"]).toBe("300");
    });

    it("registers a webhook, uploads the fixture idempotently and processes it", async () => {
      const hook = await app.inject({
        method: "POST",
        url: "/api/v1/webhooks",
        headers: bearer(),
        payload: {
          url: hooks.url,
          events: ["demo.completed", "review.completed"],
        },
      });
      expect(hook.statusCode).toBe(201);
      expect(hook.json().secret).toMatch(/^whsec_/);
      (globalThis as Record<string, unknown>).webhookSecret =
        hook.json().secret;
      const payload = await readFile(fixture!);
      const upload = () =>
        app.inject({
          method: "POST",
          url: "/api/v1/demos",
          headers: {
            ...bearer(),
            "content-type": "application/octet-stream",
            "x-filename": "public.dem",
            "idempotency-key": "upload-1",
          },
          payload,
        });
      const first = await upload();
      expect(first.statusCode).toBe(202);
      demoId = first.json().id;
      expect(first.json()).toMatchObject({
        status: "queued",
        links: { self: `http://api.test/api/v1/demos/${demoId}` },
      });
      const replay = await upload();
      expect(replay.statusCode).toBe(202);
      expect(replay.json()).toEqual(first.json());
      expect(replay.headers["idempotent-replayed"]).toBe("true");
      expect(
        (await repo.pool.query("select count(*)::int as n from uploads"))
          .rows[0].n,
      ).toBe(1);
      const notReady = await app.inject({
        url: `/api/v1/demos/${demoId}/analysis`,
        headers: bearer(),
      });
      expect(notReady.statusCode).toBe(409);
      expect(notReady.json().error.code).toBe("demo_not_ready");
      for (let i = 0; i < 5; i++) {
        await worker.runOnce();
        const status = (
          await app.inject({
            url: `/api/v1/demos/${demoId}`,
            headers: bearer(),
          })
        ).json();
        if (status.status === "complete") break;
      }
      const demo = (
        await app.inject({ url: `/api/v1/demos/${demoId}`, headers: bearer() })
      ).json();
      expect(demo.status).toBe("complete");
      expect(demo.match.players).toBeGreaterThan(0);
    });

    it("lists with filters and cursors, serves the analysis (gzip) and one player", async () => {
      await repo.pool.query("update uploads set ownership='mine' where id=$1", [
        demoId,
      ]);
      const mine = (
        await app.inject({
          url: "/api/v1/demos?ownership=mine&limit=1",
          headers: bearer(),
        })
      ).json();
      expect(mine.data.map((d: { id: string }) => d.id)).toEqual([demoId]);
      expect(mine.nextCursor).toBeNull();
      const external = (
        await app.inject({
          url: "/api/v1/demos?ownership=external",
          headers: bearer(),
        })
      ).json();
      expect(external.data).toEqual([]);
      const bad = await app.inject({
        url: "/api/v1/demos?cursor=nope",
        headers: bearer(),
      });
      expect(bad.json().error.code).toBe("invalid_cursor");
      const analysis = await app.inject({
        url: `/api/v1/demos/${demoId}/analysis`,
        headers: { ...bearer(), "accept-encoding": "gzip" },
      });
      expect(analysis.statusCode).toBe(200);
      expect(analysis.headers["content-encoding"]).toBe("gzip");
      const doc = JSON.parse(gunzipSync(analysis.rawPayload).toString("utf8"));
      expect(doc.players.length).toBeGreaterThan(0);
      expect(doc.events).toBeUndefined();
      steamId = doc.players[0].steamId;
      const withEvents = (
        await app.inject({
          url: `/api/v1/demos/${demoId}/analysis?include=events`,
          headers: bearer(),
        })
      ).json();
      expect(withEvents.events.length).toBeGreaterThan(0);
      const player = await app.inject({
        url: `/api/v1/demos/${demoId}/players/${steamId}`,
        headers: bearer(),
      });
      expect(player.statusCode).toBe(200);
      expect(player.json()).toMatchObject({ steamId, player: { steamId } });
      expect(player.json().lobby).toBeTypeOf("object");
      // Another account's key sees nothing of it.
      const otherKey = await createKey(["matches:read"], {
        authorization: "Bearer other-token",
      });
      expect(
        (
          await app.inject({
            url: `/api/v1/demos/${demoId}`,
            headers: bearer(otherKey.key),
          })
        ).statusCode,
      ).toBe(404);
    });

    it("requests a review that spends credits, lists it, and reads account data", async () => {
      const review = await app.inject({
        method: "POST",
        url: `/api/v1/demos/${demoId}/reviews`,
        headers: bearer(),
        payload: { steamId, tier: "quick", lang: "en" },
      });
      expect(review.statusCode).toBe(201);
      const created = review.json();
      expect(created).toMatchObject({
        demoId,
        steamId,
        tier: "quick",
        creditsSpent: 1,
        balance: 19,
      });
      expect(JSON.stringify(created)).not.toMatch(/mock\/qwen3|local-mock/);
      const list = (
        await app.inject({
          url: `/api/v1/demos/${demoId}/reviews`,
          headers: bearer(),
        })
      ).json();
      expect(list.data.map((r: { id: string }) => r.id)).toEqual([created.id]);
      const one = await app.inject({
        url: `/api/v1/reviews/${created.id}`,
        headers: bearer(),
      });
      expect(one.json().id).toBe(created.id);
      const me = (
        await app.inject({ url: "/api/v1/me", headers: bearer() })
      ).json();
      expect(me).toMatchObject({
        id: "owner",
        plan: { id: "pro" },
        credits: { balance: 19 },
      });
      const ledger = (
        await app.inject({
          url: "/api/v1/credits/ledger?limit=5",
          headers: bearer(),
        })
      ).json();
      expect(
        ledger.entries.some(
          (e: { reason: string }) => e.reason === "review_quick",
        ),
      ).toBe(true);
      expect(
        (await app.inject({ url: "/api/v1/progress", headers: bearer() }))
          .statusCode,
      ).toBe(200);
    });

    it("delivers signed webhooks from the outbox and a test ping", async () => {
      await container.publicApi!.delivery.runOnce();
      const types = hooks.received.map((r) => JSON.parse(r.body).type).sort();
      expect(types).toEqual(["demo.completed", "review.completed"]);
      const secret = (globalThis as Record<string, unknown>)
        .webhookSecret as string;
      for (const delivery of hooks.received) {
        expect(
          verifySignature(
            delivery.headers["fragmind-signature"]!,
            secret,
            delivery.body,
          ),
        ).toBe(true);
        expect(
          verifySignature(
            delivery.headers["fragmind-signature"]!,
            "whsec_wrong",
            delivery.body,
          ),
        ).toBe(false);
      }
      const completed = JSON.parse(
        hooks.received.find((r) => r.body.includes("demo.completed"))!.body,
      );
      expect(completed.data).toMatchObject({
        demoId,
        links: { analysis: `http://api.test/api/v1/demos/${demoId}/analysis` },
      });
      // Enqueueing again is idempotent.
      await container.publicApi!.delivery.runOnce();
      expect(hooks.received).toHaveLength(2);
      const [webhook] = (
        await app.inject({ url: "/api/v1/webhooks", headers: bearer() })
      ).json().webhooks;
      const ping = await app.inject({
        method: "POST",
        url: `/api/v1/webhooks/${webhook.id}/test`,
        headers: bearer(),
      });
      expect(ping.json()).toEqual({
        delivered: true,
        status: 204,
        error: null,
      });
      const deliveries = (
        await app.inject({
          url: "/v1/me/webhooks/deliveries",
          headers: session,
        })
      ).json();
      expect(
        deliveries.deliveries.map((d: { status: string }) => d.status),
      ).toEqual(["delivered", "delivered", "delivered"]);
    });

    it("rate limits per key by plan with RateLimit headers and Retry-After", async () => {
      await repo.updateSettings("other", {
        telemetryConsent: true,
        analyticsConsent: false,
        retentionDays: 30,
      });
      const free = await createKey(["account:read"], {
        authorization: "Bearer other-token",
      });
      let last = await app.inject({
        url: "/api/v1/me",
        headers: bearer(free.key),
      });
      expect(last.headers["ratelimit-limit"]).toBe("60");
      for (let i = 0; i < 60; i++)
        last = await app.inject({
          url: "/api/v1/me",
          headers: bearer(free.key),
        });
      expect(last.statusCode).toBe(429);
      expect(last.json().error.code).toBe("rate_limited");
      expect(Number(last.headers["retry-after"])).toBeGreaterThan(0);
      expect(last.headers["ratelimit-remaining"]).toBe("0");
    });

    it("deletes a demo, then a revoked key gets 401", async () => {
      const removed = await app.inject({
        method: "DELETE",
        url: `/api/v1/demos/${demoId}`,
        headers: bearer(),
      });
      expect(removed.statusCode).toBe(204);
      expect(
        (
          await app.inject({
            url: `/api/v1/demos/${demoId}`,
            headers: bearer(),
          })
        ).statusCode,
      ).toBe(404);
      const { keys } = (
        await app.inject({ url: "/v1/me/api-keys", headers: session })
      ).json();
      const id = keys.find((k: { prefix: string }) =>
        key.startsWith(k.prefix),
      ).id;
      expect(
        (
          await app.inject({
            method: "DELETE",
            url: `/v1/me/api-keys/${id}`,
            headers: session,
          })
        ).statusCode,
      ).toBe(200);
      const after = await app.inject({
        url: "/api/v1/demos",
        headers: bearer(),
      });
      expect(after.statusCode).toBe(401);
      expect(after.json().error.code).toBe("api_key_revoked");
    });

    it("documents every /api/v1 route and serves the spec and the docs page", async () => {
      const routes = app.publicApiRoutes
        .filter(
          (r) => r.path !== "/api/v1/openapi.json" && r.method !== "OPTIONS",
        )
        .map((r) => `${r.method} ${r.path}`)
        .sort();
      const documented = PUBLIC_OPERATIONS.map(
        (op) => `${op.method.toUpperCase()} /api/v1${op.path}`,
      ).sort();
      expect(routes).toEqual(documented);
      for (const route of app.publicApiRoutes)
        if (route.path !== "/api/v1/openapi.json")
          expect(route.scope, route.path).toBeTruthy();
      expect(routes.some((r) => r.includes("admin"))).toBe(false);
      const spec = await app.inject({ url: "/api/v1/openapi.json" });
      expect(spec.json()).toMatchObject({
        openapi: "3.1.0",
        servers: [{ url: "http://api.test/api/v1" }],
      });
      const docs = await app.inject({ url: "/api/docs" });
      expect(docs.headers["content-security-policy"]).toMatch(
        /default-src 'self'/,
      );
      expect(docs.body).toContain("/api/docs/swagger-ui-bundle.js");
      const bundle = await app.inject({
        url: "/api/docs/swagger-ui-bundle.js",
      });
      expect(bundle.statusCode).toBe(200);
      expect(
        (await app.inject({ url: "/api/docs/..%2Fpackage.json" })).statusCode,
      ).toBe(404);
    });
  },
);
