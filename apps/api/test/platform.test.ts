import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { FastifyInstance } from "fastify";
import { TestDatabase } from "./support/test-database.js";
import { digest } from "../src/shared/crypto/tokens.js";
import { buildApp } from "../src/app.js";
const databaseUrl = process.env.DATABASE_URL;
describe.skipIf(!databaseUrl)(
  "Sprint 1 real Postgres persistence and identity",
  () => {
    let admin: Pool;
    let repo: TestDatabase;
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
      repo = new TestDatabase(url);
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
        database: repo,
        devices: [],
        owners: [],
        webOrigin: "http://127.0.0.1:3000",
        apiPublicUrl: "http://127.0.0.1:4000",
        steamFetch: async (input, init) => {
          if (String(input).startsWith("https://api.steampowered.com/")) {
            const url = new URL(String(input));
            expect(url.searchParams.get("key")).toBe("steam-web-key");
            return Response.json({
              response: {
                players: [
                  {
                    steamid: url.searchParams.get("steamids"),
                    personaname: "s1mple fan",
                    avatarfull: "https://avatars.steamstatic.com/abc_full.jpg",
                    profileurl: "https://steamcommunity.com/id/fan/",
                  },
                ],
              },
            });
          }
          if (
            /^https:\/\/steamcommunity\.com\/profiles\/[0-9]{17}\/\?xml=1$/.test(
              String(input),
            )
          )
            return new Response("", { status: 503 });
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
      const second = new TestDatabase(url);
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
    it("adds Web API profile data to /v1/me when a Steam Web API key is configured", async () => {
      await repo.pool.query("update users set steam_id=$1 where id=$2", [
        "76561197960287930",
        "owner",
      ]);
      const previous = process.env.STEAM_WEB_API_KEY;
      delete process.env.STEAM_WEB_API_KEY;
      // Public XML unavailable (mocked 503) and no key: no profile, account still served.
      const before = (await app.inject({ url: "/v1/me", headers })).json();
      expect(before).toMatchObject({
        ownerId: "owner",
        role: "user",
        steamId: "76561197960287930",
      });
      expect(before.profile).toBeUndefined();
      process.env.STEAM_WEB_API_KEY = "steam-web-key";
      const me = (
        await app.inject({
          method: "POST",
          url: "/v1/me/refresh-profile",
          headers,
        })
      ).json();
      process.env.STEAM_WEB_API_KEY = previous;
      if (previous === undefined) delete process.env.STEAM_WEB_API_KEY;
      expect(me.profile).toMatchObject({
        personaName: "s1mple fan",
        avatarUrl: "https://avatars.steamstatic.com/abc_full.jpg",
        profileUrl: "https://steamcommunity.com/id/fan/",
      });
      expect(JSON.stringify(me)).not.toContain("steam-web-key");
      // The profile is stored on the account, so it survives without the key.
      delete process.env.STEAM_WEB_API_KEY;
      expect(
        (await app.inject({ url: "/v1/me", headers })).json().profile
          .personaName,
      ).toBe("s1mple fan");
      await repo.pool.query(
        "update users set steam_id=null,display_name=null,avatar_url=null,profile_url=null,steam_profile=null,steam_profile_fetched_at=null where id=$1",
        ["owner"],
      );
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
