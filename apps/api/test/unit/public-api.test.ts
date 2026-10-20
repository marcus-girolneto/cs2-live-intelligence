import { Validator } from "@seriousme/openapi-schema-validator";
import { describe, expect, it, vi } from "vitest";
import { HmacApiKeyHasher } from "../../src/infrastructure/secrets/api-key-hasher.js";
import { guardedLookup } from "../../src/infrastructure/http/webhook-transport.js";
import {
  keyPrefix,
  looksLikeApiKey,
  newApiKey,
} from "../../src/modules/api-keys/api-key.codec.js";
import type { ApiKeysRepository } from "../../src/modules/api-keys/api-keys.repository.js";
import { ApiKeysService } from "../../src/modules/api-keys/api-keys.service.js";
import {
  CachedPlanIds,
  KeyRateLimiter,
} from "../../src/modules/public-api/key-rate-limit.js";
import { publicOpenApiDocument } from "../../src/modules/public-api/openapi/document.js";
import { publicErrorBody } from "../../src/modules/public-api/public-api.gate.js";
import {
  decodeCursor,
  encodeCursor,
} from "../../src/modules/public-api/public-demos.service.js";
import { checkWebhookUrl } from "../../src/modules/webhooks/url-guard.js";
import { backoffMs } from "../../src/modules/webhooks/webhook-deliverer.js";
import {
  signatureHeader,
  verifySignature,
} from "../../src/modules/webhooks/webhook-signer.js";
import { NotFoundError } from "../../src/shared/errors/index.js";
import { isBlockedAddress } from "../../src/shared/net/address-policy.js";

const env = { APP_ENCRYPTION_KEY: "unit-test-encryption-key" };

describe("API keys: format and hashing", () => {
  it("generates fm_live_ keys of 32 base62 characters with a 4-character prefix", () => {
    const keys = new Set(Array.from({ length: 200 }, () => newApiKey()));
    expect(keys.size).toBe(200);
    for (const key of keys) {
      expect(looksLikeApiKey(key)).toBe(true);
      expect(keyPrefix(key)).toHaveLength(12);
    }
    expect(looksLikeApiKey("fm_live_short")).toBe(false);
    expect(looksLikeApiKey(`fm_test_${"a".repeat(32)}`)).toBe(false);
  });
  it("hashes with a pepper derived from the server key (stable, key-dependent)", () => {
    const key = newApiKey();
    const hasher = new HmacApiKeyHasher(() => env);
    expect(hasher.hash(key)).toBe(hasher.hash(key));
    expect(hasher.hash(key)).toMatch(/^[0-9a-f]{64}$/);
    const other = new HmacApiKeyHasher(() => ({
      APP_ENCRYPTION_KEY: "another",
    }));
    expect(other.hash(key)).not.toBe(hasher.hash(key));
    expect(() => new HmacApiKeyHasher(() => ({})).hash(key)).toThrow(
      /APP_ENCRYPTION_KEY/,
    );
  });
});

function fakeRepository(stored?: {
  revoked?: boolean;
  expired?: boolean;
  scopes?: string[];
}) {
  const events: string[] = [];
  const touched: (string | null)[] = [];
  const repo: ApiKeysRepository = {
    list: async () => [],
    create: async () => undefined,
    revoke: async () => true,
    findByHash: async () =>
      stored
        ? {
            id: "k1",
            ownerId: "o1",
            scopes: (stored.scopes ?? ["matches:read"]) as never,
            revoked: !!stored.revoked,
            expired: !!stored.expired,
          }
        : undefined,
    touch: async (_id, network) => {
      touched.push(network);
    },
    event: async (_o, _k, action, details) => {
      events.push(`${action}:${String(details?.reason ?? "")}`);
    },
  };
  return { repo, events, touched };
}
const service = (repo: ApiKeysRepository) =>
  new ApiKeysService(
    repo,
    new HmacApiKeyHasher(() => env),
    { now: () => new Date("2026-10-19T00:00:00Z") },
    { network: (ip) => `net:${ip}` },
    { baseUrl: "b", docsUrl: "d" },
  );

describe("API keys: authentication and scope guard", () => {
  it("rejects missing, malformed and unknown keys with precise codes", async () => {
    const keys = service(fakeRepository().repo);
    await expect(keys.authenticate("", "198.51.100.7")).rejects.toMatchObject({
      code: "missing_api_key",
      statusCode: 401,
    });
    await expect(
      keys.authenticate("session-token", undefined),
    ).rejects.toMatchObject({
      code: "invalid_api_key",
    });
    await expect(
      keys.authenticate(newApiKey(), undefined),
    ).rejects.toMatchObject({
      code: "invalid_api_key",
    });
  });
  it("refuses revoked and expired keys and audits the attempt", async () => {
    for (const [state, code] of [
      [{ revoked: true }, "api_key_revoked"],
      [{ expired: true }, "api_key_expired"],
    ] as const) {
      const { repo, events, touched } = fakeRepository(state);
      await expect(
        service(repo).authenticate(newApiKey(), "198.51.100.7"),
      ).rejects.toMatchObject({
        code,
      });
      expect(events).toEqual([`key.denied:${code}`]);
      expect(touched).toEqual([]);
    }
  });
  it("accepts an active key, records the use by network, and checks scopes", async () => {
    const { repo, events, touched } = fakeRepository({
      scopes: ["matches:read"],
    });
    const keys = service(repo);
    const principal = await keys.authenticate(newApiKey(), "198.51.100.7");
    expect(principal).toEqual({
      keyId: "k1",
      ownerId: "o1",
      scopes: ["matches:read"],
    });
    expect(touched).toEqual(["net:198.51.100.7"]);
    await keys.authorize(principal, "matches:read");
    await expect(
      keys.authorize(principal, "reviews:write"),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "insufficient_scope",
    });
    expect(events).toEqual(["key.denied:insufficient_scope"]);
  });
});

describe("per-key rate limiter", () => {
  it("limits by plan per minute window and reports remaining and reset", () => {
    let now = 0;
    const limiter = new KeyRateLimiter(() => now);
    expect(KeyRateLimiter.limitFor("free")).toBe(60);
    expect(KeyRateLimiter.limitFor("basic")).toBe(120);
    expect(KeyRateLimiter.limitFor("pro")).toBe(300);
    expect(KeyRateLimiter.limitFor("unknown")).toBe(60);
    let decision = limiter.hit("k", 2);
    expect(decision).toEqual({
      allowed: true,
      limit: 2,
      remaining: 1,
      resetSeconds: 60,
    });
    limiter.hit("k", 2);
    now = 30_000;
    decision = limiter.hit("k", 2);
    expect(decision).toMatchObject({
      allowed: false,
      remaining: 0,
      resetSeconds: 30,
    });
    expect(limiter.hit("other", 2).allowed).toBe(true);
    now = 60_000;
    expect(limiter.hit("k", 2).allowed).toBe(true);
  });
  it("fails closed when the key table is full of live windows", () => {
    const limiter = new KeyRateLimiter(() => 0, 2);
    limiter.hit("a", 10);
    limiter.hit("b", 10);
    expect(limiter.hit("c", 10).allowed).toBe(false);
  });
  it("caches plan ids briefly", async () => {
    let now = 0;
    const source = vi.fn(async () => "pro");
    const plans = new CachedPlanIds(source, 1000, () => now);
    await plans.planId("o");
    await plans.planId("o");
    now = 2000;
    await plans.planId("o");
    expect(source).toHaveBeenCalledTimes(2);
  });
});

describe("webhook signatures", () => {
  it("signs t.body with HMAC-SHA256 and verifies with tolerance", () => {
    const body = JSON.stringify({ id: "d1", type: "demo.completed" });
    const header = signatureHeader("whsec_s", 1_760_000_000, body);
    expect(header).toMatch(/^t=1760000000,v1=[0-9a-f]{64}$/);
    expect(verifySignature(header, "whsec_s", body, 1_760_000_100)).toBe(true);
    expect(verifySignature(header, "whsec_x", body, 1_760_000_100)).toBe(false);
    expect(verifySignature(header, "whsec_s", body + " ", 1_760_000_100)).toBe(
      false,
    );
    expect(verifySignature(header, "whsec_s", body, 1_760_001_000)).toBe(false);
    expect(verifySignature("garbage", "whsec_s", body)).toBe(false);
  });
  it("backs off exponentially up to six hours", () => {
    expect([1, 2, 3, 8].map(backoffMs)).toEqual([
      30_000, 60_000, 120_000, 3_840_000,
    ]);
    expect(backoffMs(30)).toBe(6 * 3_600_000);
  });
});

describe("SSRF guard", () => {
  it("blocks private, loopback, link-local, metadata and mapped addresses", () => {
    for (const ip of [
      "10.1.2.3",
      "127.0.0.1",
      "169.254.169.254",
      "172.20.0.1",
      "192.168.1.1",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "fe80::1",
      "fd00:ec2::254",
      "::ffff:127.0.0.1",
      "::ffff:a9fe:a9fe",
      "64:ff9b::10.0.0.1",
      "not-an-ip",
    ])
      expect(isBlockedAddress(ip), ip).toBe(true);
    for (const ip of ["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])
      expect(isBlockedAddress(ip), ip).toBe(false);
  });
  it("checks webhook URLs: https only, no credentials, public hosts", () => {
    const strict = { allowPrivateNetworks: false };
    expect(checkWebhookUrl("https://example.com/hook", strict).hostname).toBe(
      "example.com",
    );
    for (const url of [
      "http://example.com/hook",
      "https://user:pass@example.com/",
      "https://localhost/hook",
      "https://169.254.169.254/latest/meta-data",
      "https://[::1]/hook",
      "https://10.0.0.5/hook",
      "https://metadata.google.internal/",
      "ftp://example.com/",
      "not a url",
    ])
      expect(() => checkWebhookUrl(url, strict), url).toThrow();
    const local = { allowPrivateNetworks: true };
    expect(checkWebhookUrl("http://localhost:9000/hook", local).port).toBe(
      "9000",
    );
    expect(() => checkWebhookUrl("http://example.com/hook", local)).toThrow();
  });
  it("refuses at connection time when DNS resolves to a blocked address", async () => {
    const lookup = guardedLookup(false);
    const error = await new Promise<Error | null>((resolve) =>
      lookup("localhost", {}, (err) => resolve(err)),
    );
    expect(error?.message).toMatch(/blocked address/);
    const allowed = await new Promise<Error | null>((resolve) =>
      guardedLookup(true)("localhost", {}, (err) => resolve(err)),
    );
    expect(allowed).toBeNull();
  });
});

describe("public API helpers", () => {
  it("wraps every error as {error:{code,message,details?,requestId}}", () => {
    expect(publicErrorBody(new NotFoundError("Demo not found"), "r1")).toEqual({
      status: 404,
      headers: {},
      body: {
        error: {
          code: "not_found",
          message: "Demo not found",
          requestId: "r1",
        },
      },
    });
    const crash = publicErrorBody(new Error("database password leaked"), "r2");
    expect(crash.status).toBe(500);
    expect(JSON.stringify(crash.body)).not.toContain("password");
  });
  it("round-trips cursors and rejects forged ones", () => {
    const id = "8d7c2f1e-4b1a-4c7e-9a55-0d1f3c2b9e10";
    const cursor = encodeCursor("2026-10-19T18:22:05.123456Z", id);
    expect(decodeCursor(cursor)).toEqual({
      createdAt: "2026-10-19T18:22:05.123456Z",
      id,
    });
    expect(() => decodeCursor("bm9wZQ")).toThrow(/Invalid cursor/);
    expect(() =>
      decodeCursor(Buffer.from("x' or 1=1|" + id).toString("base64url")),
    ).toThrow();
  });
});

describe("OpenAPI document", () => {
  it("is a valid OpenAPI 3.1 document with security, scopes and webhooks", async () => {
    const doc = publicOpenApiDocument("https://api.fragmind.example");
    const result = await new Validator().validate(doc);
    expect(result.errors ?? []).toEqual([]);
    expect(result.valid).toBe(true);
    expect(doc.openapi).toBe("3.1.0");
    const paths = doc.paths as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    for (const [path, ops] of Object.entries(paths))
      for (const [method, op] of Object.entries(ops)) {
        expect(op["x-required-scope"], `${method} ${path}`).toBeTruthy();
        expect(Object.keys(op.responses as object)).toEqual(
          expect.arrayContaining(["401", "403", "429"]),
        );
      }
    expect(Object.keys(doc.webhooks as object).sort()).toEqual([
      "demo.completed",
      "demo.failed",
      "review.completed",
    ]);
    expect(JSON.stringify(doc)).not.toMatch(/\/v1\/admin|\/admin\//);
  });
});
