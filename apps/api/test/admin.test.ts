import { unwrapData } from "@cs2/coaching";
import { afterAll, beforeAll, beforeEach, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Pool } from "pg";
import type { FastifyInstance } from "fastify";
import { analyzeDemo } from "@cs2/analytics";
import { generateCoaching } from "@cs2/coaching";
import { TestDatabase } from "./support/test-database.js";
import { buildApp } from "../src/app.js";
import {
  decryptSecret,
  encryptSecret,
  encryptionKey,
} from "../src/infrastructure/secrets/aes-gcm-secret-cipher.js";

describe("secret encryption", () => {
  it("round-trips with AES-256-GCM, binds context and rejects other keys", () => {
    const env = { APP_ENCRYPTION_KEY: "a".repeat(64) };
    const key = encryptionKey(env);
    const ct = encryptSecret("sk-very-secret", "ctx", key);
    expect(ct.startsWith("v1:")).toBe(true);
    expect(ct).not.toContain("sk-very-secret");
    expect(encryptSecret("sk-very-secret", "ctx", key)).not.toBe(ct);
    expect(decryptSecret(ct, "ctx", key)).toBe("sk-very-secret");
    expect(() => decryptSecret(ct, "other", key)).toThrow();
    expect(() =>
      decryptSecret(
        ct,
        "ctx",
        encryptionKey({ APP_ENCRYPTION_KEY: "other passphrase" }),
      ),
    ).toThrow();
    // Fallback derives a stable key from WEB_TOKEN and warns once.
    const warnings: string[] = [];
    const a = encryptionKey({ WEB_TOKEN: "web-token-x" }, (m) =>
      warnings.push(m),
    );
    const b = encryptionKey({ WEB_TOKEN: "web-token-x" }, (m) =>
      warnings.push(m),
    );
    expect(a.equals(b)).toBe(true);
    expect(a.length).toBe(32);
    expect(() => encryptionKey({})).toThrow(/APP_ENCRYPTION_KEY/);
  });
});

const databaseUrl = process.env.DATABASE_URL;
describe.skipIf(!databaseUrl)(
  "roles, admin AI configuration and settings",
  () => {
    let admin: Pool;
    let repo: TestDatabase;
    let app: FastifyInstance;
    let server: Server;
    let base: string;
    let directory: string;
    const schema = "admin_" + randomUUID().replaceAll("-", "");
    const adminHeaders = { authorization: "Bearer admin-token" };
    const userHeaders = { authorization: "Bearer user-token" };
    const SECRET = "sk-admin-secret-1234";
    let hits: {
      url: string;
      auth?: string;
      org?: string;
      model?: string;
      body: Record<string, unknown>;
    }[] = [];
    const saved = { ...process.env };
    beforeAll(async () => {
      server = createServer((req, res) => {
        let raw = "";
        req.on("data", (c) => (raw += c));
        req.on("end", () => {
          const auth = req.headers.authorization;
          if (req.method === "GET") {
            hits.push({ url: req.url ?? "", auth, body: {} });
            if (req.url === "/openrouter/v1/models") {
              res.writeHead(200, { "content-type": "application/json" });
              return res.end(
                JSON.stringify({
                  data: [
                    {
                      id: "vendor/big",
                      name: "Vendor: Big",
                      context_length: 200000,
                      pricing: { prompt: "0.000003", completion: "0.000015" },
                      supported_parameters: ["tools", "structured_outputs"],
                    },
                    {
                      id: "vendor/free",
                      pricing: { prompt: "0", completion: "0" },
                      supported_parameters: ["temperature"],
                    },
                  ],
                }),
              );
            }
            if (req.url === "/v1/models") {
              res.writeHead(200, { "content-type": "application/json" });
              return res.end(
                JSON.stringify({
                  data: [
                    { id: "zeta-model" },
                    { id: "alpha-model" },
                    { id: "alpha-model" },
                    { nope: 1 },
                  ],
                }),
              );
            }
            res.writeHead(404);
            return res.end("not found");
          }
          if (req.url?.startsWith("/nolist/")) {
            res.writeHead(404, { "content-type": "application/json" });
            return res.end(
              JSON.stringify({ error: { message: "no such route" } }),
            );
          }
          const body = JSON.parse(raw) as {
            model: string;
            messages: { content: string }[];
          };
          const org = req.headers["x-org"] as string | undefined;
          if (raw.includes("fact checker of this app")) {
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
          hits.push({ url: req.url ?? "", auth, org, model: body.model, body });
          const user = body.messages[1]!.content;
          let parsed: { facts?: { id: string }[]; recentRounds?: unknown } = {};
          try {
            parsed = unwrapData(user) as typeof parsed;
          } catch {
            /* connectivity check */
          }
          const content = parsed.recentRounds
            ? {
                call: "Trade your entry.",
                why: "You died untraded.",
                focus: "trade",
                confidence: "medium",
              }
            : parsed.facts
              ? {
                  summary: "Mock review.",
                  insights: [
                    {
                      observation: "Opening duels decided your rounds.",
                      evidenceIds: [parsed.facts[0]!.id],
                      confidence: "medium",
                      actionablePractice:
                        "Play opening fights with a teammate.",
                      caveats: [],
                      kind: "improve",
                    },
                  ],
                  plan: ["Trade your entry fragger"],
                }
              : { ok: true, reply: "Working." };
          res.writeHead(200, { "content-type": "application/json" });
          res.end(
            JSON.stringify({
              model: body.model,
              choices: [
                {
                  finish_reason: "stop",
                  message: { content: JSON.stringify(content) },
                },
              ],
              usage: { prompt_tokens: 10, completion_tokens: 5 },
            }),
          );
        });
      });
      await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      admin = new Pool({ connectionString: databaseUrl });
      await admin.query(`create schema ${schema}`);
      const dbUrl = new URL(databaseUrl!);
      dbUrl.searchParams.set("options", `-c search_path=${schema}`);
      repo = new TestDatabase(dbUrl.toString());
      await repo.migrate();
      await repo.migrate();
      await repo.seedDev("admin-1", "admin-token", "d1", "d1-token");
      await repo.seedDev("user-1", "user-token", "d2", "d2-token");
      await repo.pool.query("update users set role='admin' where id='admin-1'");
      directory = await mkdtemp(resolve(tmpdir(), "cs2-admin-"));
      app = await buildApp({
        database: repo,
        devices: [],
        owners: [],
        webOrigin: "http://127.0.0.1:3000",
        jobs: {
          storageDir: directory,
          parserBin: process.execPath,
          disableWorker: true,
        },
      });
    });
    beforeEach(async () => {
      hits = [];
      process.env = { ...saved };
      for (const k of Object.keys(process.env))
        if (k.startsWith("AI_") || k.startsWith("OPENAI_"))
          delete process.env[k];
      process.env.APP_ENCRYPTION_KEY = "test-encryption-passphrase";
      process.env.AI_PROVIDER = "env-mock";
      process.env.AI_BASE_URL = `${base}/v1`;
      process.env.AI_API_KEY = "sk-env";
      process.env.AI_MODEL = "env-model";
      await repo.pool.query("delete from provider_usage");
    });
    afterAll(async () => {
      process.env = saved;
      await app?.close();
      await repo?.close();
      await new Promise((r) => server?.close(r));
      if (directory) await rm(directory, { recursive: true, force: true });
      if (admin) {
        await admin.query(`drop schema ${schema} cascade`);
        await admin.end();
      }
    });
    const call = (
      method: string,
      url: string,
      headers: Record<string, string> = adminHeaders,
      payload?: unknown,
    ) =>
      app.inject({
        method: method as "GET",
        url,
        headers,
        ...(payload !== undefined ? { payload: payload as object } : {}),
      });
    async function createProvider(over: Record<string, unknown> = {}) {
      const r = await call("POST", "/v1/admin/ai/providers", adminHeaders, {
        name: "Mock DB",
        provider: "db-mock",
        baseUrl: `${base}/v1`,
        apiKey: SECRET,
        headers: { "X-Org": "org-secret-header" },
        temperature: 0.2,
        ...over,
      });
      expect(r.statusCode).toBe(201);
      return r.json();
    }
    async function completedAnalysis(ownerId: string) {
      const id = randomUUID();
      await repo.createJob(ownerId, {
        id,
        filename: "m.dem",
        objectKey: id + ".dem",
        // Distinct files: jobs with one checksum are parsed one at a time (dedupe).
        checksum: "x-" + id,
        size: 1,
      });
      const job = await repo.claimJob();
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
      await repo.finishJob(id, job!.leaseToken, {
        analysis,
        coaching: await generateCoaching(analysis),
      });
      return { id, steamId: analysis.players[0]!.steamId };
    }

    it("requires the admin role on every admin endpoint", async () => {
      const id = randomUUID();
      const endpoints: [string, string][] = [
        ["GET", "/v1/admin/ai/providers"],
        ["POST", "/v1/admin/ai/providers"],
        ["PUT", `/v1/admin/ai/providers/${id}`],
        ["DELETE", `/v1/admin/ai/providers/${id}`],
        ["POST", `/v1/admin/ai/providers/${id}/test`],
        ["GET", `/v1/admin/ai/providers/${id}/models`],
        ["GET", "/v1/admin/ai/assignments"],
        ["PUT", "/v1/admin/ai/assignments"],
        ["POST", "/v1/admin/ai/test"],
        ["GET", "/v1/admin/settings"],
        ["PUT", "/v1/admin/settings"],
        ["GET", "/v1/admin/users"],
        ["PUT", "/v1/admin/users/admin-1/role"],
        ["GET", "/v1/admin/audit"],
      ];
      for (const [method, url] of endpoints) {
        expect(
          (await call(method, url, userHeaders, {})).statusCode,
          `${method} ${url}`,
        ).toBe(403);
        expect(
          (await call(method, url, {}, {})).statusCode,
          `${method} ${url}`,
        ).toBe(401);
      }
      expect((await call("GET", "/v1/me", userHeaders)).json().role).toBe(
        "user",
      );
      expect((await call("GET", "/v1/me")).json().role).toBe("admin");
      // Regular users still manage their own coaching approach.
      expect(
        (await call("GET", "/v1/coach/profile", userHeaders)).statusCode,
      ).toBe(200);
    });

    it("stores provider keys encrypted and never returns them", async () => {
      const created = await createProvider();
      expect(created).toMatchObject({
        name: "Mock DB",
        provider: "db-mock",
        keyConfigured: true,
        keyLast4: "1234",
        headerNames: ["X-Org"],
        temperature: 0.2,
        assignedTo: [],
      });
      const listed = (await call("GET", "/v1/admin/ai/providers")).json();
      for (const text of [JSON.stringify(created), JSON.stringify(listed)]) {
        expect(text).not.toContain(SECRET);
        expect(text).not.toContain("org-secret-header");
      }
      const row = (
        await repo.pool.query(
          "select api_key_enc,headers_enc,row_to_json(p)::text as all from ai_providers p where id=$1",
          [created.id],
        )
      ).rows[0];
      expect(row.all).not.toContain(SECRET);
      expect(row.all).not.toContain("org-secret-header");
      expect(row.api_key_enc).toMatch(/^v1:/);
      expect(
        decryptSecret(row.api_key_enc, `ai_provider:${created.id}:apiKey`),
      ).toBe(SECRET);
      // Updating other fields keeps the key; null clears it; short keys have no last4.
      const renamed = (
        await call(
          "PUT",
          `/v1/admin/ai/providers/${created.id}`,
          adminHeaders,
          { name: "Renamed" },
        )
      ).json();
      expect(renamed).toMatchObject({
        name: "Renamed",
        keyConfigured: true,
        keyLast4: "1234",
      });
      const short = (
        await call(
          "PUT",
          `/v1/admin/ai/providers/${created.id}`,
          adminHeaders,
          { apiKey: "short" },
        )
      ).json();
      expect(short).toMatchObject({ keyConfigured: true, keyLast4: null });
      const cleared = (
        await call(
          "PUT",
          `/v1/admin/ai/providers/${created.id}`,
          adminHeaders,
          { apiKey: null, temperature: null },
        )
      ).json();
      expect(cleared).toMatchObject({
        keyConfigured: false,
        keyLast4: null,
        temperature: null,
      });
      expect(
        (await call("DELETE", `/v1/admin/ai/providers/${created.id}`))
          .statusCode,
      ).toBe(204);
      const audit = JSON.stringify(
        (await call("GET", "/v1/admin/audit")).json(),
      );
      expect(audit).toContain("ai.provider.create");
      expect(audit).toContain("ai.provider.update");
      expect(audit).not.toContain(SECRET);
      expect(audit).not.toContain("short");
      expect(audit).not.toContain("org-secret-header");
    });

    it("validates provider input through the shared AI config loader", async () => {
      const bad = [
        { name: "x", provider: "Bad Label!", baseUrl: `${base}/v1` },
        { name: "x", provider: "lan", baseUrl: "http://10.1.2.3/v1" },
        {
          name: "x",
          provider: "x",
          baseUrl: "https://u:" + "p" + "@" + "host.example/v1",
        },
        { name: "x", provider: "custom" },
        { name: "x", provider: "x", baseUrl: `${base}/v1`, apiStyle: "soap" },
        {
          name: "x",
          provider: "x",
          baseUrl: `${base}/v1`,
          headers: { "X-A": "a\nb" },
        },
        { name: "x", provider: "x", baseUrl: `${base}/v1`, unknown: true },
      ];
      for (const payload of bad)
        expect(
          (await call("POST", "/v1/admin/ai/providers", adminHeaders, payload))
            .statusCode,
          JSON.stringify(payload),
        ).toBe(400);
      // Presets need no base URL; LAN HTTP is allowed only with allowHttp.
      const preset = await createProvider({
        name: "OpenRouter",
        provider: "openrouter",
        baseUrl: null,
      });
      const lan = await createProvider({
        name: "LAN",
        provider: "lan",
        baseUrl: "http://10.1.2.3/v1",
        allowHttp: true,
      });
      await call("DELETE", `/v1/admin/ai/providers/${preset.id}`);
      await call("DELETE", `/v1/admin/ai/providers/${lan.id}`);
    });

    it("uses purpose-specific database models over the environment fallback", async () => {
      // No database assignment: the environment is used.
      let status = (await call("GET", "/v1/ai/status", adminHeaders)).json();
      expect(status).toMatchObject({
        configured: true,
        source: "env",
        model: "env-model",
        purposes: {
          review: { source: "env", model: "env-model" },
          live: { source: "env", model: "env-model" },
        },
      });
      await call("POST", "/v1/ai/test", adminHeaders);
      expect(hits.at(-1)).toMatchObject({
        model: "env-model",
        auth: "Bearer sk-env",
      });

      const p = await createProvider();
      // Invalid assignments are rejected.
      expect(
        (
          await call("PUT", "/v1/admin/ai/assignments", adminHeaders, {
            review: { providerId: randomUUID(), model: "m" },
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await call("PUT", "/v1/admin/ai/assignments", adminHeaders, {
            review: { providerId: p.id, model: "has space" },
          })
        ).statusCode,
      ).toBe(400);
      const set = await call("PUT", "/v1/admin/ai/assignments", adminHeaders, {
        review: { providerId: p.id, model: "review-model" },
        live: { providerId: p.id, model: "live-model" },
      });
      expect(set.statusCode).toBe(200);
      expect(set.json().assignments).toMatchObject({
        review: { providerId: p.id, model: "review-model" },
        live: { providerId: p.id, model: "live-model" },
      });
      status = (await call("GET", "/v1/ai/status", adminHeaders)).json();
      expect(status).toMatchObject({
        configured: true,
        source: "database",
        providerId: p.id,
        providerName: "Mock DB",
        provider: "db-mock",
        model: "review-model",
        keyConfigured: true,
        purposes: {
          review: { source: "database", model: "review-model" },
          review_quick: { source: "database", model: "review-model" },
          review_deep: { source: "database", model: "review-model" },
          report: { source: "database", model: "review-model" },
          personal_coach: { source: "database", model: "review-model" },
          live: { source: "database", model: "live-model" },
        },
      });
      expect(JSON.stringify(status)).not.toContain(SECRET);
      // Non-admins only learn whether the coach is configured, never which model powers it.
      const publicStatus = (
        await call("GET", "/v1/ai/status", userHeaders)
      ).json();
      expect(publicStatus).toEqual({
        configured: true,
        purposes: {
          review: { configured: true },
          review_quick: { configured: true },
          review_deep: { configured: true },
          review_team: { configured: true },
          verify: { configured: true },
          live: { configured: true },
          report: { configured: true },
          personal_coach: { configured: true },
        },
      });
      expect((await call("POST", "/v1/ai/test", userHeaders)).statusCode).toBe(
        403,
      );

      hits = [];
      expect(
        (await call("POST", "/v1/ai/test", adminHeaders)).json(),
      ).toMatchObject({
        ok: true,
        model: "review-model",
        purpose: "review_quick",
      });
      expect(
        (
          await call("POST", "/v1/ai/test", adminHeaders, { purpose: "live" })
        ).json(),
      ).toMatchObject({ model: "live-model", purpose: "live" });
      // Live AI calls need a paid plan (free: 0 live AI matches per day).
      await repo.pool.query(
        "insert into subscriptions(owner_id,plan_id,status,source) values('user-1','pro','active','admin') on conflict(owner_id) do update set plan_id='pro'",
      );
      const { id, steamId } = await completedAnalysis("user-1");
      await repo.grantCredits("user-1", 1);
      const review = await call(
        "POST",
        `/v1/analyses/${id}/coaching`,
        userHeaders,
        { steamId },
      );
      expect(review.statusCode).toBe(200);
      const live = await call("POST", "/v1/ai/live-call", userHeaders, {
        state: {
          map: "de_mirage",
          phase: "freezetime",
          round: 3,
          score: { ct: 1, t: 1 },
          ownStats: { kills: 1, deaths: 2 },
        },
        recentRounds: [{ round: 1, kills: 1, died: true }],
      });
      expect(live.statusCode).toBe(200);
      expect(hits.map((h) => h.model)).toEqual([
        "review-model",
        "live-model",
        "review-model",
        "live-model",
      ]);
      expect(hits.every((h) => h.auth === `Bearer ${SECRET}`)).toBe(true);
      // Stored (encrypted) headers are applied to provider calls.
      expect(hits.every((h) => h.org === "org-secret-header")).toBe(true);
      expect(hits.every((h) => h.url === "/v1/chat/completions")).toBe(true);
      expect(hits[0]!.body.temperature).toBe(0.2);

      // An assigned provider cannot be deleted; clearing a purpose falls back to env.
      expect(
        (await call("DELETE", `/v1/admin/ai/providers/${p.id}`)).statusCode,
      ).toBe(409);
      await call("PUT", "/v1/admin/ai/assignments", adminHeaders, {
        live: null,
      });
      status = (await call("GET", "/v1/ai/status", adminHeaders)).json();
      expect(status.purposes.live).toMatchObject({
        source: "env",
        model: "env-model",
      });
      expect(status.purposes.review).toMatchObject({
        source: "database",
        model: "review-model",
      });
      await call("PUT", "/v1/admin/ai/assignments", adminHeaders, {
        review: null,
      });
      expect(
        (await call("DELETE", `/v1/admin/ai/providers/${p.id}`)).statusCode,
      ).toBe(204);
    });

    it("tests providers with a model override and lists their models", async () => {
      const p = await createProvider();
      expect(
        (
          await call(
            "POST",
            `/v1/admin/ai/providers/${p.id}/test`,
            adminHeaders,
            {},
          )
        ).statusCode,
      ).toBe(400);
      hits = [];
      const tested = await call(
        "POST",
        `/v1/admin/ai/providers/${p.id}/test`,
        adminHeaders,
        { model: "override-model" },
      );
      expect(tested.statusCode).toBe(200);
      expect(tested.json()).toMatchObject({
        ok: true,
        model: "override-model",
        reply: "Working.",
      });
      expect(hits[0]).toMatchObject({
        model: "override-model",
        auth: `Bearer ${SECRET}`,
      });
      const models = (
        await call("GET", `/v1/admin/ai/providers/${p.id}/models`)
      ).json();
      expect(models).toEqual({
        supported: true,
        models: ["alpha-model", "zeta-model"],
      });
      expect(hits.at(-1)!.auth).toBe(`Bearer ${SECRET}`);
      // OpenRouter-style lists also return pricing per million tokens and capabilities.
      const router = await createProvider({
        name: "Router",
        baseUrl: `${base}/openrouter/v1`,
      });
      expect(
        (
          await call("GET", `/v1/admin/ai/providers/${router.id}/models`)
        ).json(),
      ).toEqual({
        supported: true,
        models: ["vendor/big", "vendor/free"],
        details: [
          {
            id: "vendor/big",
            name: "Vendor: Big",
            contextLength: 200000,
            pricePerMTokIn: 3,
            pricePerMTokOut: 15,
            structuredOutputs: true,
          },
          {
            id: "vendor/free",
            pricePerMTokIn: 0,
            pricePerMTokOut: 0,
            structuredOutputs: false,
          },
        ],
      });
      // Per-purpose connectivity checks: resolved config, or another model/provider.
      const purposeTest = await call(
        "POST",
        "/v1/admin/ai/test",
        adminHeaders,
        {
          purpose: "personal_coach",
        },
      );
      expect(purposeTest.statusCode).toBe(200);
      expect(purposeTest.json()).toMatchObject({
        ok: true,
        purpose: "personal_coach",
      });
      expect(
        (
          await call("POST", "/v1/admin/ai/test", adminHeaders, {
            purpose: "review_deep",
            providerId: p.id,
            model: "candidate-model",
          })
        ).json(),
      ).toMatchObject({
        ok: true,
        model: "candidate-model",
        purpose: "review_deep",
      });
      expect(
        (
          await call("POST", "/v1/admin/ai/test", adminHeaders, {
            purpose: "nope",
          })
        ).statusCode,
      ).toBe(400);
      // Providers without /models are tolerated.
      const noList = await createProvider({
        name: "No list",
        baseUrl: `${base}/nolist/v1`,
      });
      const none = await call(
        "GET",
        `/v1/admin/ai/providers/${noList.id}/models`,
      );
      expect(none.statusCode).toBe(200);
      expect(none.json()).toMatchObject({ supported: false, models: [] });
      const failing = await call(
        "POST",
        `/v1/admin/ai/providers/${noList.id}/test`,
        adminHeaders,
        { model: "m" },
      );
      expect(failing.statusCode).toBe(502);
      expect(JSON.stringify(failing.json())).not.toContain(SECRET);
      expect(
        (await call("GET", `/v1/admin/ai/providers/${randomUUID()}/models`))
          .statusCode,
      ).toBe(404);
    });

    it("reports undecryptable keys instead of using them", async () => {
      const p = await createProvider();
      await call("PUT", "/v1/admin/ai/assignments", adminHeaders, {
        review: { providerId: p.id, model: "m1" },
      });
      process.env.APP_ENCRYPTION_KEY = "a-different-key";
      // Cache invalidation happens on admin changes; force it with a settings read.
      await call("GET", "/v1/admin/settings");
      const status = (await call("GET", "/v1/ai/status", adminHeaders)).json();
      expect(status).toMatchObject({ configured: false, source: "database" });
      expect(status.reason).toMatch(/decrypt/);
      expect((await call("POST", "/v1/ai/test", adminHeaders)).statusCode).toBe(
        503,
      );
      expect(
        (
          await call("PUT", `/v1/admin/ai/providers/${p.id}`, adminHeaders, {
            name: "x",
          })
        ).statusCode,
      ).toBe(409);
      expect(
        (
          await call("PUT", `/v1/admin/ai/providers/${p.id}`, adminHeaders, {
            apiKey: "sk-new-key-0000",
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (await call("GET", "/v1/ai/status", adminHeaders)).json(),
      ).toMatchObject({ configured: true, keyConfigured: true });
      await call("PUT", "/v1/admin/ai/assignments", adminHeaders, {
        review: null,
      });
    });

    it("applies app-wide settings: daily limit, input size and sample demo", async () => {
      const before = (await call("GET", "/v1/admin/settings")).json();
      expect(before.settings).toEqual({
        dailyLimit: null,
        maxInputBytes: null,
        sampleDemoEnabled: true,
        personalCoachIntervalDays: 7,
        personalCoachNewMatches: 3,
        maxDemoBytes: 524_288_000,
        timezone: null,
        verifierEnabled: true,
        promptAb: {},
      });
      expect(
        (
          await call("PUT", "/v1/admin/settings", adminHeaders, {
            dailyLimit: -1,
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (await call("PUT", "/v1/admin/settings", adminHeaders, { other: 1 }))
          .statusCode,
      ).toBe(400);
      const saved = await call("PUT", "/v1/admin/settings", adminHeaders, {
        dailyLimit: 1,
        sampleDemoEnabled: false,
      });
      expect(saved.json()).toMatchObject({
        settings: {
          dailyLimit: 1,
          maxInputBytes: null,
          sampleDemoEnabled: false,
        },
        effective: {
          dailyLimit: 1,
          maxInputBytes: 200000,
          sampleDemoEnabled: false,
        },
      });
      // The global cap applies to every account, admins included (plan quotas do not).
      expect((await call("POST", "/v1/ai/test", adminHeaders)).statusCode).toBe(
        200,
      );
      const limited = await call("POST", "/v1/ai/test", adminHeaders);
      expect(limited.statusCode).toBe(429);
      expect(limited.json().code).toBe("ai_limit");
      process.env.SAMPLE_DEMO_FILE = process.execPath;
      expect(
        (await call("GET", "/v1/demos/sample", userHeaders)).json(),
      ).toEqual({ available: false });
      expect(
        (await call("POST", "/v1/demos/sample", userHeaders)).statusCode,
      ).toBe(404);
      const capped = await call("PUT", "/v1/admin/settings", adminHeaders, {
        dailyLimit: 0,
        maxInputBytes: 1000,
      });
      expect(capped.json().effective).toMatchObject({
        dailyLimit: null,
        maxInputBytes: 1000,
      });
      // dailyLimit 0 = unlimited.
      expect((await call("POST", "/v1/ai/test", adminHeaders)).statusCode).toBe(
        200,
      );
      expect(
        (await call("GET", "/v1/ai/status", adminHeaders)).json().dailyLimit,
      ).toBeNull();
      await call("PUT", "/v1/admin/settings", adminHeaders, {
        dailyLimit: null,
        maxInputBytes: null,
        sampleDemoEnabled: true,
      });
      expect(
        (await call("GET", "/v1/demos/sample", userHeaders)).json(),
      ).toEqual({ available: true });
    });

    it("re-queues finished analyses whose demo is still stored (admin only)", async () => {
      await repo.pool.query("delete from demo_jobs");
      // user-1: one complete with its file, one complete whose file is gone.
      const kept = await completedAnalysis("user-1");
      await writeFile(resolve(directory, kept.id + ".dem"), "demo");
      await completedAnalysis("user-1");
      // admin-1: one failed with its file, one still queued (left alone).
      const failed = randomUUID();
      await repo.createJob("admin-1", {
        id: failed,
        filename: "f.dem",
        objectKey: failed + ".dem",
        checksum: "x-" + failed,
        size: 1,
      });
      const lease = await repo.claimJob();
      await repo.finishJob(failed, lease!.leaseToken, {
        error: "Demo parser failed",
      });
      await writeFile(resolve(directory, failed + ".dem"), "demo");
      const queuedId = randomUUID();
      await repo.createJob("admin-1", {
        id: queuedId,
        filename: "q.dem",
        objectKey: queuedId + ".dem",
        checksum: "x-" + queuedId,
        size: 1,
      });
      await writeFile(resolve(directory, queuedId + ".dem"), "demo");

      expect(
        (await call("POST", "/v1/admin/analyses/reprocess", userHeaders, {}))
          .statusCode,
      ).toBe(403);
      expect(
        (await call("POST", "/v1/admin/analyses/reprocess", {}, {})).statusCode,
      ).toBe(401);
      expect(
        (
          await call("POST", "/v1/admin/analyses/reprocess", adminHeaders, {
            ownerId: 5,
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await call("POST", "/v1/admin/analyses/reprocess", adminHeaders, {
            other: 1,
          })
        ).statusCode,
      ).toBe(400);
      const one = await call(
        "POST",
        "/v1/admin/analyses/reprocess",
        adminHeaders,
        { ownerId: "user-1" },
      );
      expect(one.json()).toEqual({ queued: 1 });
      const status = async () =>
        Object.fromEntries(
          (
            await repo.pool.query(
              "select id,status,attempts,error from demo_jobs",
            )
          ).rows.map((r) => [r.id, r]),
        );
      let rows = await status();
      expect(rows[kept.id]).toMatchObject({
        status: "queued",
        attempts: 0,
        error: null,
      });
      expect(rows[failed]).toMatchObject({ status: "failed" });
      // Default: everyone. Already-queued jobs are not counted again.
      const all = await call(
        "POST",
        "/v1/admin/analyses/reprocess",
        adminHeaders,
      );
      expect(all.json()).toEqual({ queued: 1 });
      rows = await status();
      expect(rows[failed]).toMatchObject({
        status: "queued",
        attempts: 0,
        error: null,
      });
      expect(
        Object.values(rows).filter(
          (r) => (r as { status: string }).status === "complete",
        ),
      ).toHaveLength(1);
      // The worker can claim re-queued jobs again.
      const claimed = new Set<string>();
      for (let i = 0; i < 3; i++) {
        const job = await repo.claimJob();
        if (job) claimed.add(job.id);
      }
      expect(claimed).toEqual(new Set([kept.id, failed, queuedId]));
      const audit = (await call("GET", "/v1/admin/audit?limit=1")).json()
        .entries[0];
      expect(audit).toMatchObject({
        action: "analyses.reprocess",
        details: { ownerId: null, queued: 1 },
      });
      await repo.pool.query("delete from demo_jobs");
    });

    it("lists users and protects the last admin", async () => {
      const users = (await call("GET", "/v1/admin/users")).json().users;
      expect(
        users.find((u: { id: string }) => u.id === "user-1"),
      ).toMatchObject({
        id: "user-1",
        steamId: null,
        role: "user",
        matches: expect.any(Number),
        reviews: expect.any(Number),
        createdAt: expect.any(String),
      });
      expect(
        (
          await call("PUT", "/v1/admin/users/admin-1/role", adminHeaders, {
            role: "user",
          })
        ).statusCode,
      ).toBe(409);
      expect(
        (
          await call("PUT", "/v1/admin/users/admin-1/role", adminHeaders, {
            role: "owner",
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await call("PUT", "/v1/admin/users/nobody/role", adminHeaders, {
            role: "admin",
          })
        ).statusCode,
      ).toBe(404);
      const promoted = await call(
        "PUT",
        "/v1/admin/users/user-1/role",
        adminHeaders,
        { role: "admin" },
      );
      expect(promoted.json()).toMatchObject({ id: "user-1", role: "admin" });
      expect(
        (await call("GET", "/v1/admin/users", userHeaders)).statusCode,
      ).toBe(200);
      // With two admins one may step down, but then the other is the last one.
      expect(
        (
          await call("PUT", "/v1/admin/users/admin-1/role", adminHeaders, {
            role: "user",
          })
        ).statusCode,
      ).toBe(200);
      expect((await call("GET", "/v1/admin/users")).statusCode).toBe(403);
      expect(
        (
          await call("PUT", "/v1/admin/users/user-1/role", userHeaders, {
            role: "user",
          })
        ).statusCode,
      ).toBe(409);
      expect(
        (
          await call("PUT", "/v1/admin/users/admin-1/role", userHeaders, {
            role: "admin",
          })
        ).statusCode,
      ).toBe(200);
      await call("PUT", "/v1/admin/users/user-1/role", adminHeaders, {
        role: "user",
      });
      const audit = (await call("GET", "/v1/admin/audit?limit=5")).json()
        .entries;
      expect(audit.length).toBeLessThanOrEqual(5);
      expect(audit[0]).toMatchObject({
        action: "user.role",
        adminId: "admin-1",
        details: { userId: "user-1", role: "user" },
      });
    });
  },
);
