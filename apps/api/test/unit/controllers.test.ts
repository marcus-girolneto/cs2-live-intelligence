import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { StaticIdentity } from "../../src/modules/auth/identity.js";
import { DevicesController } from "../../src/modules/devices/devices.controller.js";
import type { DevicesRepository } from "../../src/modules/devices/devices.repository.js";
import { registerDevicesRoutes } from "../../src/modules/devices/devices.routes.js";
import { DevicesService } from "../../src/modules/devices/devices.service.js";
import { FeedbackController } from "../../src/modules/feedback/feedback.controller.js";
import { registerFeedbackRoutes } from "../../src/modules/feedback/feedback.routes.js";
import { FeedbackService } from "../../src/modules/feedback/feedback.service.js";
import { PrivacyController } from "../../src/modules/privacy/privacy.controller.js";
import type { SettingsDto } from "../../src/modules/privacy/privacy.dto.js";
import { registerPrivacyRoutes } from "../../src/modules/privacy/privacy.routes.js";
import { PrivacyService } from "../../src/modules/privacy/privacy.service.js";
import { installErrorHandler } from "../../src/shared/errors/index.js";
import { AuthGuards } from "../../src/shared/http/guards.js";
import { RecordingInvalidation } from "./fakes.js";

const auth = { authorization: "Bearer web-token" };
const apps: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
});

function app() {
  const identity = new StaticIdentity(
    [{ token: "web-token", ownerId: "o" }],
    [],
  );
  const guards = new AuthGuards(identity, identity, identity);
  const server = Fastify();
  installErrorHandler(server);
  const invalidation = new RecordingInvalidation();
  const devices: DevicesRepository = {
    deviceForToken: async () => undefined,
    list: async () => [
      { deviceId: "d1", name: "pc", createdAt: "t", revokedAt: null },
    ],
    createPairingCode: async (_o, name) => ({ code: name, expiresAt: "t" }),
    claim: async () => undefined,
    rotate: async () => undefined,
    revoke: async (_o, id) => id === "d1",
  };
  registerDevicesRoutes(
    server,
    new DevicesController(new DevicesService(devices, invalidation)),
    guards,
  );
  let stored: SettingsDto = {
    telemetryConsent: true,
    analyticsConsent: false,
    retentionDays: 30,
  };
  registerPrivacyRoutes(
    server,
    new PrivacyController(
      new PrivacyService(
        {
          settings: async () => stored,
          update: async (_o, s) => void (stored = s),
          deleteAccount: async () => undefined,
        },
        invalidation,
      ),
    ),
    guards,
  );
  registerFeedbackRoutes(
    server,
    new FeedbackController(
      new FeedbackService({
        feedback: async () => ({ id: "f1" }),
        productEvent: async (_o, name) => name !== "blocked",
      }),
    ),
    guards,
  );
  apps.push(server);
  return { server, invalidation };
}

describe("route tables + controllers (HTTP contract)", () => {
  it("answers 401 {error} without a valid bearer token", async () => {
    const { server } = app();
    for (const url of ["/v1/devices", "/v1/settings"]) {
      const response = await server.inject({ url });
      expect([response.statusCode, response.json()]).toEqual([
        401,
        { error: "Unauthorized" },
      ]);
    }
    const wrong = await server.inject({
      url: "/v1/devices",
      headers: { authorization: "Bearer nope" },
    });
    expect(wrong.statusCode).toBe(401);
  });
  it("devices: list, pair validation, public claim, 204/404 revoke with invalidation", async () => {
    const { server, invalidation } = app();
    expect(
      (await server.inject({ url: "/v1/devices", headers: auth })).json(),
    ).toEqual({
      devices: [
        { deviceId: "d1", name: "pc", createdAt: "t", revokedAt: null },
      ],
    });
    const bad = await server.inject({
      method: "POST",
      url: "/v1/devices/pair",
      headers: auth,
      payload: {},
    });
    expect([bad.statusCode, bad.json()]).toEqual([
      400,
      { error: "Invalid pairing request" },
    ]);
    const pair = await server.inject({
      method: "POST",
      url: "/v1/devices/pair",
      headers: auth,
      payload: { name: "Desk" },
    });
    expect(pair.json()).toEqual({ code: "Desk", expiresAt: "t" });
    const claim = await server.inject({
      method: "POST",
      url: "/v1/devices/claim",
      payload: { code: "x".repeat(43) },
    });
    expect([claim.statusCode, claim.json()]).toEqual([
      400,
      { error: "Invalid or expired pairing code" },
    ]);
    expect(
      (
        await server.inject({
          method: "DELETE",
          url: "/v1/devices/d1",
          headers: auth,
        })
      ).statusCode,
    ).toBe(204);
    const missing = await server.inject({
      method: "DELETE",
      url: "/v1/devices/zz",
      headers: auth,
    });
    expect([missing.statusCode, missing.json()]).toEqual([
      404,
      { error: "Device not found" },
    ]);
    expect(invalidation.owners).toEqual(["o"]);
  });
  it("settings: validation message, update round-trip and account deletion", async () => {
    const { server, invalidation } = app();
    const bad = await server.inject({
      method: "PUT",
      url: "/v1/settings",
      headers: auth,
      payload: { retentionDays: "x" },
    });
    expect([bad.statusCode, bad.json()]).toEqual([
      400,
      { error: "Invalid settings" },
    ]);
    const next = {
      telemetryConsent: false,
      analyticsConsent: true,
      retentionDays: 7,
    };
    expect(
      (
        await server.inject({
          method: "PUT",
          url: "/v1/settings",
          headers: auth,
          payload: next,
        })
      ).json(),
    ).toEqual(next);
    expect(
      (await server.inject({ url: "/v1/settings", headers: auth })).json(),
    ).toEqual(next);
    expect(
      (
        await server.inject({
          method: "DELETE",
          url: "/v1/account",
          headers: auth,
        })
      ).statusCode,
    ).toBe(204);
    expect(invalidation.owners).toEqual(["o", "o"]);
  });
  it("feedback and events: 201/202, validation and 403", async () => {
    const { server } = app();
    const post = (url: string, payload: object) =>
      server.inject({ method: "POST", url, headers: auth, payload });
    expect((await post("/v1/feedback", { rating: 5 })).statusCode).toBe(201);
    expect((await post("/v1/feedback", { rating: 9 })).json()).toEqual({
      error: "Invalid feedback",
    });
    const ok = await post("/v1/events", {
      name: "page_view",
      properties: { tab: "maps", n: 1 },
    });
    expect([ok.statusCode, ok.json()]).toEqual([202, { accepted: true }]);
    expect((await post("/v1/events", { name: "Bad Name" })).json()).toEqual({
      error: "Invalid event",
    });
    expect(
      (await post("/v1/events", { name: "x", properties: { Bad: 1 } })).json(),
    ).toEqual({ error: "Invalid event properties" });
    expect(
      (
        await post("/v1/events", {
          name: "x",
          properties: { a: { nested: 1 } },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await post("/v1/events", { name: "x", properties: [] })).statusCode,
    ).toBe(400);
    const blocked = await post("/v1/events", { name: "blocked" });
    expect([blocked.statusCode, blocked.json()]).toEqual([
      403,
      { error: "Analytics consent required or daily event quota reached" },
    ]);
  });
});
