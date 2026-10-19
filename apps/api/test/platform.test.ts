import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { FastifyInstance } from "fastify";
import { PgRepository, digest } from "../src/repository.js";
import { buildApp } from "../src/app.js";
const databaseUrl = process.env.DATABASE_URL;
describe.skipIf(!databaseUrl)(
  "Sprint 1 real Postgres persistence and identity",
  () => {
    let admin: Pool;
    let repo: PgRepository;
    let app: FastifyInstance;
    let url: string;
    const schema = "test_" + randomUUID().replaceAll("-", "");
    const headers = { authorization: "Bearer owner-token" };
    beforeAll(async () => {
      admin = new Pool({ connectionString: databaseUrl });
      await admin.query(`create schema ${schema}`);
      const dbUrl = new URL(databaseUrl!);
      dbUrl.searchParams.set("options", `-c search_path=${schema}`);
      url = dbUrl.toString();
      repo = new PgRepository(url);
      await repo.migrate();
      await repo.migrate();
      await repo.seedDev("owner", "owner-token", "device", "device-token");
      await repo.seedDev(
        "other",
        "other-owner",
        "other-device",
        "other-device-token",
      );
      app = await buildApp({
        repository: repo,
        devices: [],
        owners: [],
        webOrigin: "http://127.0.0.1:3000",
        apiPublicUrl: "http://127.0.0.1:4000",
        steamFetch: async (input, init) => {
          expect(input).toBe("https://steamcommunity.com/openid/login");
          expect(
            new URLSearchParams(init?.body as URLSearchParams).get(
              "openid.mode",
            ),
          ).toBe("check_authentication");
          return new Response(
            "ns:http://specs.openid.net/auth/2.0\nis_valid:true\n",
          );
        },
      });
    });
    afterAll(async () => {
      await app?.close();
      await repo?.close();
      if (admin) {
        await admin.query(`drop schema ${schema} cascade`);
        await admin.end();
      }
    });
    function telemetry(seq: number, eventId = `event${seq}`) {
      return {
        schemaVersion: "1.0",
        eventId,
        deviceId: "device",
        sessionId: "session",
        sequence: seq,
        observedAt: new Date().toISOString(),
        receivedAt: new Date().toISOString(),
        source: "gsi",
        visibility: "own-player",
        payload: { map: { name: "de_dust2" } },
      };
    }
    it("stores only digests; persists atomic dedup/sequence across connections and concurrent writes", async () => {
      const stored = await repo.pool.query(
        "select token_hash from devices where id=$1",
        ["device"],
      );
      expect(stored.rows[0].token_hash).toBe(digest("device-token"));
      const push = (body: object) =>
        app.inject({
          method: "POST",
          url: "/v1/telemetry/gsi",
          headers: { authorization: "Bearer device-token" },
          payload: body,
        });
      const responses = await Promise.all(
        Array.from({ length: 20 }, (_, i) => push(telemetry(i + 1))),
      );
      expect(responses.every((r) => r.statusCode === 202)).toBe(true);
      expect((await repo.session("session"))?.state.sequence).toBe(20);
      expect((await push(telemetry(20))).json().status).toBe("duplicate");
      const second = new PgRepository(url);
      expect((await second.session("session"))?.state.sequence).toBe(20);
      expect(await second.owner("owner-token")).toBe("owner");
      await second.close();
      expect(
        (
          await app.inject({
            url: "/v1/live/sessions/session",
            headers: { authorization: "Bearer other-owner" },
          })
        ).statusCode,
      ).toBe(404);
    });
    it("persists consent and blocks telemetry when disabled", async () => {
      const settings = {
        telemetryConsent: false,
        analyticsConsent: false,
        retentionDays: 7,
      };
      expect(
        (
          await app.inject({
            method: "PUT",
            url: "/v1/settings",
            headers,
            payload: settings,
          })
        ).json(),
      ).toEqual(settings);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/v1/telemetry/gsi",
            headers: { authorization: "Bearer device-token" },
            payload: telemetry(21),
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (await app.inject({ url: "/v1/settings", headers })).json(),
      ).toEqual(settings);
      await app.inject({
        method: "PUT",
        url: "/v1/settings",
        headers,
        payload: { ...settings, telemetryConsent: true },
      });
    });
    it("pairs once, isolates owners, rotates old credentials and revokes", async () => {
      const paired = (
        await app.inject({
          method: "POST",
          url: "/v1/devices/pair",
          headers,
          payload: { name: "My collector" },
        })
      ).json();
      expect(paired.code).toBeTypeOf("string");
      const claim = (
        await app.inject({
          method: "POST",
          url: "/v1/devices/claim",
          payload: { code: paired.code },
        })
      ).json();
      expect(await repo.device(claim.token)).toMatchObject({
        deviceId: claim.deviceId,
        ownerId: "owner",
      });
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/v1/devices/claim",
            payload: { code: paired.code },
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await app.inject({
            method: "POST",
            url: `/v1/devices/${claim.deviceId}/rotate`,
            headers: { authorization: "Bearer other-owner" },
          })
        ).statusCode,
      ).toBe(404);
      const rotated = (
        await app.inject({
          method: "POST",
          url: `/v1/devices/${claim.deviceId}/rotate`,
          headers,
        })
      ).json();
      expect(await repo.device(claim.token)).toBeUndefined();
      expect(rotated.token).toBeUndefined();
      const claimedRotation = (
        await app.inject({
          method: "POST",
          url: "/v1/devices/claim",
          payload: { code: rotated.code },
        })
      ).json();
      expect(claimedRotation.deviceId).toBe(claim.deviceId);
      expect(await repo.device(claimedRotation.token)).toBeDefined();
      expect(
        (
          await app.inject({
            method: "DELETE",
            url: `/v1/devices/${claim.deviceId}`,
            headers,
          })
        ).statusCode,
      ).toBe(204);
      expect(await repo.device(claimedRotation.token)).toBeUndefined();
    });
    it("verifies fixed Steam endpoint and one-use state, nonce, browser-bound exchange", async () => {
      const started = await app.inject({ url: "/v1/auth/steam/start" });
      const steam = new URL(started.json().url);
      const returned = steam.searchParams.get("openid.return_to")!;
      const state = new URL(returned).searchParams.get("state")!;
      const nonce =
        new Date().toISOString().replace(".000", "").slice(0, 19) + "Zunique";
      const parameters = new URLSearchParams({
        state,
        "openid.ns": "http://specs.openid.net/auth/2.0",
        "openid.mode": "id_res",
        "openid.op_endpoint": "https://steamcommunity.com/openid/login",
        "openid.return_to": returned,
        "openid.claimed_id":
          "https://steamcommunity.com/openid/id/76561198000000000",
        "openid.identity":
          "https://steamcommunity.com/openid/id/76561198000000000",
        "openid.response_nonce": nonce,
        "openid.signed":
          "op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle",
        "openid.assoc_handle": "handle",
        "openid.sig": "signature",
      });
      const callback = "/v1/auth/steam/callback?" + parameters;
      expect((await app.inject({ url: callback })).statusCode).toBe(400);
      const verified = await app.inject({
        url: callback,
        headers: { cookie: `cs2_steam_state=${state}` },
      });
      expect(verified.statusCode).toBe(302);
      const code = new URL(verified.headers.location!).searchParams.get("code");
      const cookies = verified.headers["set-cookie"] as string[];
      const binding = cookies
        .find((c) => c.startsWith("cs2_steam_exchange="))!
        .split(";")[0];
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/v1/auth/exchange",
            payload: { code },
          })
        ).statusCode,
      ).toBe(400);
      const exchange = await app.inject({
        method: "POST",
        url: "/v1/auth/exchange",
        headers: { cookie: binding },
        payload: { code },
      });
      expect(exchange.statusCode).toBe(200);
      const ownerId = await repo.owner(exchange.json().token);
      expect(ownerId).toBeDefined();
      expect((await repo.settings(ownerId!)).telemetryConsent).toBe(false);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/v1/auth/exchange",
            headers: { cookie: binding },
            payload: { code },
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await app.inject({
            url: callback,
            headers: { cookie: `cs2_steam_state=${state}` },
          })
        ).statusCode,
      ).toBe(400);
    });
    it("rejects wrong Steam endpoint, stale nonce and changed return_to before network", async () => {
      const started = await app.inject({ url: "/v1/auth/steam/start" });
      const steam = new URL(started.json().url);
      const returned = steam.searchParams.get("openid.return_to")!;
      const state = new URL(returned).searchParams.get("state")!;
      const variants: Array<Record<string, string>> = [
        { "openid.op_endpoint": "https://attacker.example" },
        { "openid.return_to": "http://evil.invalid" },
        { "openid.response_nonce": "2000-01-01T00:00:00Znonce" },
      ];
      for (const query of variants) {
        const q = new URLSearchParams({
          state,
          "openid.ns": "http://specs.openid.net/auth/2.0",
          "openid.mode": "id_res",
          ...query,
        });
        expect(
          (
            await app.inject({
              url: "/v1/auth/steam/callback?" + q,
              headers: { cookie: `cs2_steam_state=${state}` },
            })
          ).statusCode,
        ).toBe(400);
      }
    });
    it("lists only owned live history and logs out durable tokens", async () => {
      expect(
        (await app.inject({ url: "/v1/live/sessions", headers })).json()
          .sessions[0],
      ).toMatchObject({ sessionId: "session" });
      expect(
        (
          await app.inject({
            url: "/v1/live/sessions",
            headers: { authorization: "Bearer other-owner" },
          })
        ).json(),
      ).toEqual({ sessions: [] });
      expect(
        (await app.inject({ url: "/v1/devices", headers })).statusCode,
      ).toBe(200);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/v1/auth/logout",
            headers: { authorization: "Bearer other-owner" },
          })
        ).statusCode,
      ).toBe(204);
      expect(await repo.owner("other-owner")).toBeUndefined();
      expect(
        (
          await app.inject({
            url: "/v1/me",
            headers: { authorization: "Bearer other-owner" },
          })
        ).statusCode,
      ).toBe(401);
      const docs = (await app.inject({ url: "/openapi.json" })).json();
      expect(
        docs.paths["/v1/demos/uploads"].post.responses["413"],
      ).toBeDefined();
      expect(docs.paths["/v1/devices/{id}/rotate"]).toBeDefined();
    });
    it("deletes owner and cascades tokens devices and telemetry", async () => {
      expect(
        (await app.inject({ method: "DELETE", url: "/v1/account", headers }))
          .statusCode,
      ).toBe(204);
      expect(await repo.owner("owner-token")).toBeUndefined();
      expect(await repo.device("device-token")).toBeUndefined();
      expect(await repo.session("session")).toBeUndefined();
    });
  },
);
