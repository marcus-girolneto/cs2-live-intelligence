import { afterAll, beforeAll, beforeEach, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { FastifyInstance } from "fastify";
import { TestDatabase } from "./support/test-database.js";
import { buildApp } from "../src/app.js";
import {
  htmlToText,
  safeImageUrl,
  safeProfileUrl,
} from "../src/infrastructure/steam/steam-text.js";
import { parseProfileXml } from "../src/infrastructure/steam/profile-xml.js";
import { sanitizeStoredProfile } from "../src/infrastructure/steam/sanitize-profile.js";

const STEAM_ID = "76561198000000001";
const KEY = "ABCDEF0123456789ABCDEF0123456789"; // gitleaks:allow (fake test value)

function profileXml(over: Record<string, string> = {}, extra = "") {
  const v = {
    steamID64: STEAM_ID,
    steamID: "<![CDATA[Fan &amp; Friend]]>",
    onlineState: "in-game",
    stateMessage: "<![CDATA[In-Game<br/>Counter-Strike 2]]>",
    privacyState: "public",
    avatarMedium:
      "<![CDATA[https://avatars.fastly.steamstatic.com/abc_medium.jpg]]>",
    avatarFull:
      "<![CDATA[https://avatars.fastly.steamstatic.com/abc_full.jpg]]>",
    vacBanned: "0",
    customURL: "<![CDATA[fan]]>",
    memberSince: "October 12, 2010",
    location: "<![CDATA[São Paulo, Brazil]]>",
    realname: "<![CDATA[Fan Name]]>",
    summary:
      '<![CDATA[Hello <b>world</b>&nbsp;&amp; friends<br>Second line <a href="https://x.invalid">link</a>]]>',
    ...over,
  };
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><profile>
${Object.entries(v)
  .map(([k, x]) => `\t<${k}>${x}</${k}>`)
  .join("\n")}
\t<mostPlayedGames>
\t\t<mostPlayedGame><gameName><![CDATA[Counter-Strike 2]]></gameName><gameLink><![CDATA[https://steamcommunity.com/app/730]]></gameLink><gameIcon><![CDATA[https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/730/icon.jpg]]></gameIcon><hoursPlayed>12.5</hoursPlayed><hoursOnRecord>1,234.5</hoursOnRecord></mostPlayedGame>
\t\t<mostPlayedGame><gameName><![CDATA[Dota 2]]></gameName><gameLink><![CDATA[https://steamcommunity.com/app/570]]></gameLink><gameIcon><![CDATA[https://evil.example/icon.jpg]]></gameIcon><hoursPlayed>2.0</hoursPlayed><hoursOnRecord>40</hoursOnRecord></mostPlayedGame>
\t</mostPlayedGames>
\t<groups><group isPrimary="1"><groupID64>1</groupID64><summary><![CDATA[group bio]]></summary><avatarFull><![CDATA[https://evil.example/g.jpg]]></avatarFull></group><group isPrimary="0"><groupID64>2</groupID64></group></groups>
${extra}</profile>`;
}

describe("Steam profile parsing and sanitization", () => {
  it("turns bio HTML into plain text and neutralizes markup", () => {
    expect(
      htmlToText("Hi <b>there</b><br/>line&nbsp;two &amp; &#x263A; &#9731;"),
    ).toBe("Hi there\nline two & ☺ ☃");
    const evil = htmlToText(
      `<script>alert(1)</script>ok<style>x{}</style> &lt;img src=x onerror=alert(1)&gt; &lt;script&gt;bad()&lt;/script&gt; <img src=x onerror=alert(2)> <!-- c --> ‮flip &amp;lt;b&amp;gt;`,
    )!;
    expect(evil).not.toMatch(/[<>]/);
    expect(evil).not.toMatch(/script|onerror|alert\(1\)|alert\(2\)/i);
    expect(evil).toContain("ok");
    expect(evil).toContain("bad()");
    expect(evil).not.toContain("‮");
    // Entities are decoded exactly once.
    expect(evil).toContain("&lt;b&gt;");
    expect(htmlToText("No information given.")).toBeUndefined();
    expect([...htmlToText("a".repeat(5000))!].length).toBe(2000);
  });
  it("allowlists Steam image and profile URLs only", () => {
    expect(safeImageUrl("https://avatars.steamstatic.com/a.jpg")).toBeTruthy();
    expect(
      safeImageUrl("https://cdn.cloudflare.steamstatic.com/a.jpg"),
    ).toBeTruthy();
    expect(safeImageUrl("https://steamcdn-a.akamaihd.net/a.jpg")).toBeTruthy();
    for (const bad of [
      "http://avatars.steamstatic.com/a.jpg",
      "https://evil.example/a.jpg",
      "https://steamstatic.com.evil.example/a.jpg",
      "https://evilsteamstatic.com/a.jpg",
      "https://other.akamaihd.net/a.jpg",
      "javascript:alert(1)",
      "https://user:" + "p" + "@" + "avatars.steamstatic.com/a.jpg",
    ])
      expect(safeImageUrl(bad)).toBeUndefined();
    expect(safeProfileUrl("https://steamcommunity.com/id/fan/")).toBe(
      "https://steamcommunity.com/id/fan/",
    );
    expect(
      safeProfileUrl("https://steamcommunity.com/profiles/76561198000000001"),
    ).toBeTruthy();
    expect(safeProfileUrl("https://steamcommunity.com/linkfilter/?u=x")).toBe(
      undefined,
    );
    expect(safeProfileUrl("https://steamcommunity.evil/id/fan")).toBe(
      undefined,
    );
    expect(safeProfileUrl("http://steamcommunity.com/id/fan")).toBe(undefined);
  });
  it("parses the community XML without DTD/entity processing", () => {
    const p = parseProfileXml(profileXml(), STEAM_ID)!;
    expect(p).toMatchObject({
      personaName: "Fan & Friend",
      realName: "Fan Name",
      location: "São Paulo, Brazil",
      visibility: "public",
      personaState: "in-game",
      currentGame: "Counter-Strike 2",
      steamMemberSince: "2010-10-12T00:00:00.000Z",
      profileUrl: "https://steamcommunity.com/id/fan/",
      cs2: { playtimeHours: 1234.5, playtime2WeeksHours: 12.5 },
      groupsCount: 2,
      summary: "Hello world & friends\nSecond line link",
    });
    expect(p.recentGames).toEqual([
      {
        appId: 730,
        name: "Counter-Strike 2",
        playtime2WeeksHours: 12.5,
        iconUrl:
          "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/730/icon.jpg",
      },
      { appId: 570, name: "Dota 2", playtime2WeeksHours: 2 },
    ]);
    expect(
      parseProfileXml(
        `<?xml version="1.0"?><!DOCTYPE profile [<!ENTITY x "boom">]>` +
          profileXml().replace(/^<\?xml[^>]*\?>/, ""),
        STEAM_ID,
      ),
    ).toBeNull();
    // A profile for a different account is never accepted.
    expect(parseProfileXml(profileXml(), "76561198000000002")).toBeNull();
    expect(
      parseProfileXml(
        "<response><error><![CDATA[The specified profile could not be found.]]></error></response>",
        STEAM_ID,
      ),
    ).toBeNull();
  });
  it("re-validates cached profiles before serving them", () => {
    const p = sanitizeStoredProfile({
      personaName: "x",
      avatarUrl: "https://evil.example/a.jpg",
      summary: "<script>bad()</script>hi",
      visibility: "weird",
      fetchedAt: "2026-01-01T00:00:00Z",
      steamLevel: -3,
    })!;
    expect(p.avatarUrl).toBeUndefined();
    expect(p.summary).toBe("hi");
    expect(p.visibility).toBe("private");
    expect(p.steamLevel).toBeUndefined();
  });
});

const databaseUrl = process.env.DATABASE_URL;
describe.skipIf(!databaseUrl)("GET /v1/me Steam profile", () => {
  let admin: Pool;
  let repo: TestDatabase;
  let app: FastifyInstance;
  const schema = "steam_" + randomUUID().replaceAll("-", "");
  // Per-test Steam behaviour.
  let xml: string | "fail" | number = profileXml();
  let api: Record<string, unknown | "fail" | number> = {};
  const seen: string[] = [];
  const savedKey = process.env.STEAM_WEB_API_KEY;
  const steamFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    seen.push(url);
    if (
      url === `https://steamcommunity.com/profiles/${STEAM_ID}/?xml=1` ||
      /^https:\/\/steamcommunity\.com\/profiles\/[0-9]{17}\/\?xml=1$/.test(url)
    ) {
      if (xml === "fail") throw new TypeError("fetch failed");
      if (typeof xml === "number") return new Response("", { status: xml });
      const body = xml.replaceAll(STEAM_ID, url.split("/")[4]!);
      return new Response(body, { headers: { "content-type": "text/xml" } });
    }
    if (url.startsWith("https://api.steampowered.com/")) {
      const u = new URL(url);
      expect(u.searchParams.get("key")).toBe(KEY);
      const name = u.pathname.split("/")[2]!;
      const r = api[name];
      if (r === undefined || r === "fail") throw new TypeError("fetch failed");
      if (typeof r === "number") return new Response("{}", { status: r });
      return Response.json(r);
    }
    if (url === "https://steamcommunity.com/openid/login") {
      expect(
        new URLSearchParams(init?.body as URLSearchParams).get("openid.mode"),
      ).toBe("check_authentication");
      return new Response(
        "ns:http://specs.openid.net/auth/2.0\nis_valid:true\n",
      );
    }
    throw new Error("unexpected fetch " + url.replace(/key=[^&]+/, "key=***"));
  };
  const fullApi = () => ({
    GetPlayerSummaries: {
      response: {
        players: [
          {
            steamid: STEAM_ID,
            personaname: "API Name",
            realname: "Real From API",
            avatarfull: "https://avatars.steamstatic.com/api_full.jpg",
            avatarmedium: "https://evil.example/api_medium.jpg",
            profileurl: "https://steamcommunity.com/id/fan/",
            loccountrycode: "BR",
            timecreated: 1286841600,
            lastlogoff: 1760000000,
            personastate: 3,
            communityvisibilitystate: 3,
          },
        ],
      },
    },
    GetSteamLevel: { response: { player_level: 42 } },
    GetOwnedGames: {
      response: {
        game_count: 1,
        games: [{ appid: 730, playtime_forever: 90000, playtime_2weeks: 600 }],
      },
    },
    GetRecentlyPlayedGames: {
      response: {
        total_count: 2,
        games: [
          {
            appid: 730,
            name: "Counter-Strike 2",
            playtime_2weeks: 600,
            img_icon_url: "8dbc71957312bbd3baea65848b545be9eae2a355",
          },
          {
            appid: 570,
            name: "Dota 2",
            playtime_2weeks: 30,
            img_icon_url: "../../evil",
          },
        ],
      },
    },
    GetPlayerBans: {
      players: [
        {
          SteamId: STEAM_ID,
          CommunityBanned: false,
          VACBanned: true,
          NumberOfVACBans: 1,
          DaysSinceLastBan: 900,
          NumberOfGameBans: 0,
        },
      ],
    },
    GetBadges: { response: { badges: [{}, {}, {}], player_level: 42 } },
    GetFriendList: { friendslist: { friends: [{}, {}] } },
  });
  async function account(steamId: string | null = STEAM_ID) {
    const id = "acct-" + randomUUID();
    const token = "token-" + randomUUID();
    await repo.seedDev(id, token, "dev-" + id, "devtok-" + id);
    if (steamId)
      await repo.pool.query("update users set steam_id=$1 where id=$2", [
        steamId,
        id,
      ]);
    return { id, headers: { authorization: `Bearer ${token}` } };
  }
  async function me(headers: Record<string, string>) {
    const r = await app.inject({ url: "/v1/me", headers });
    expect(r.statusCode).toBe(200);
    return r.json();
  }
  beforeAll(async () => {
    admin = new Pool({ connectionString: databaseUrl });
    await admin.query(`create schema ${schema}`);
    const dbUrl = new URL(databaseUrl!);
    dbUrl.searchParams.set("options", `-c search_path=${schema}`);
    repo = new TestDatabase(dbUrl.toString());
    await repo.migrate();
    app = await buildApp({
      database: repo,
      devices: [],
      owners: [],
      webOrigin: "http://127.0.0.1:3000",
      apiPublicUrl: "http://127.0.0.1:4000",
      steamFetch,
    });
  });
  beforeEach(async () => {
    xml = profileXml();
    api = {};
    seen.length = 0;
    delete process.env.STEAM_WEB_API_KEY;
    delete process.env.ADMIN_BOOTSTRAP;
    delete process.env.ADMIN_STEAM_IDS;
    await repo.pool.query(
      "update users set steam_id=null where steam_id is not null",
    );
  });
  afterAll(async () => {
    if (savedKey === undefined) delete process.env.STEAM_WEB_API_KEY;
    else process.env.STEAM_WEB_API_KEY = savedKey;
    delete process.env.ADMIN_BOOTSTRAP;
    delete process.env.ADMIN_STEAM_IDS;
    await app?.close();
    await repo?.close();
    if (admin) {
      await admin.query(`drop schema ${schema} cascade`);
      await admin.end();
    }
  });

  it("builds a profile from the public XML without any key", async () => {
    const a = await account();
    xml = profileXml({
      avatarMedium: "<![CDATA[https://evil.example/medium.jpg]]>",
      summary:
        "<![CDATA[<script>alert('x')</script>Clutch <i>king</i> &lt;img src=x onerror=alert(1)&gt;]]>",
    });
    const body = await me(a.headers);
    expect(body).toMatchObject({
      ownerId: a.id,
      role: "user",
      steamId: STEAM_ID,
      profile: {
        personaName: "Fan & Friend",
        realName: "Fan Name",
        avatarUrl: "https://avatars.fastly.steamstatic.com/abc_full.jpg",
        profileUrl: "https://steamcommunity.com/id/fan/",
        location: "São Paulo, Brazil",
        steamMemberSince: "2010-10-12T00:00:00.000Z",
        personaState: "in-game",
        currentGame: "Counter-Strike 2",
        visibility: "public",
        cs2: { playtimeHours: 1234.5, playtime2WeeksHours: 12.5 },
        bans: { vacBans: 0, gameBans: 0, communityBanned: false },
        groupsCount: 2,
      },
    });
    expect(body.memberSince).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(body.profile.avatarMediumUrl).toBeUndefined();
    expect(body.profile.summary).not.toMatch(/[<>]|script|onerror/);
    expect(body.profile.summary).toContain("Clutch king");
    expect(Date.parse(body.profile.fetchedAt)).toBeGreaterThan(
      Date.now() - 60000,
    );
    expect(seen.some((u) => u.includes("api.steampowered.com"))).toBe(false);
    // Legacy columns stay in sync for compatibility.
    const row = await repo.pool.query(
      "select display_name,avatar_url,profile_url from users where id=$1",
      [a.id],
    );
    expect(row.rows[0]).toEqual({
      display_name: "Fan & Friend",
      avatar_url: "https://avatars.fastly.steamstatic.com/abc_full.jpg",
      profile_url: "https://steamcommunity.com/id/fan/",
    });
    // Served from cache while fresh: no new Steam call.
    seen.length = 0;
    await me(a.headers);
    expect(seen).toHaveLength(0);
  });

  it("merges the Web API when a key is set, tolerating partial failures, never exposing the key", async () => {
    process.env.STEAM_WEB_API_KEY = KEY;
    api = { ...fullApi(), GetBadges: "fail", GetFriendList: 401 };
    const a = await account();
    const body = await me(a.headers);
    expect(body.profile).toMatchObject({
      personaName: "API Name",
      realName: "Real From API",
      avatarUrl: "https://avatars.steamstatic.com/api_full.jpg",
      // The Web API medium avatar is off-allowlist, so the XML one is kept.
      avatarMediumUrl: "https://avatars.fastly.steamstatic.com/abc_medium.jpg",
      countryCode: "BR",
      location: "São Paulo, Brazil",
      summary: "Hello world & friends\nSecond line link",
      steamMemberSince: "2010-10-12T00:00:00.000Z",
      lastLogoff: new Date(1760000000 * 1000).toISOString(),
      steamLevel: 42,
      personaState: "away",
      visibility: "public",
      cs2: { playtimeHours: 1500, playtime2WeeksHours: 10 },
      bans: {
        vacBans: 1,
        gameBans: 0,
        communityBanned: false,
        daysSinceLastBan: 900,
      },
      groupsCount: 2,
    });
    expect(body.profile.recentGames).toEqual([
      {
        appId: 730,
        name: "Counter-Strike 2",
        playtime2WeeksHours: 10,
        iconUrl:
          "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/730/8dbc71957312bbd3baea65848b545be9eae2a355.jpg",
      },
      { appId: 570, name: "Dota 2", playtime2WeeksHours: 0.5 },
    ]);
    expect(body.profile.friendsCount).toBeUndefined();
    expect(body.profile.badgesCount).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain(KEY);
    const stored = await repo.pool.query(
      "select steam_profile::text as p from users where id=$1",
      [a.id],
    );
    expect(stored.rows[0].p).not.toContain(KEY);
    // XML down but Web API up → still a profile (forced refresh).
    xml = "fail";
    api = fullApi();
    const forced = await app.inject({
      method: "POST",
      url: "/v1/me/refresh-profile",
      headers: a.headers,
    });
    expect(forced.statusCode).toBe(200);
    expect(forced.json().profile).toMatchObject({
      personaName: "API Name",
      friendsCount: 2,
      badgesCount: 3,
      visibility: "public",
    });
    expect(forced.json().profile.summary).toBeUndefined();
    expect(JSON.stringify(forced.json())).not.toContain(KEY);
  });

  it("reports private profiles with what Steam still shows", async () => {
    const a = await account();
    xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><profile>
\t<steamID64>${STEAM_ID}</steamID64>
\t<steamID><![CDATA[Hidden]]></steamID>
\t<onlineState>offline</onlineState>
\t<stateMessage><![CDATA[Offline]]></stateMessage>
\t<privacyState>private</privacyState>
\t<visibilityState>1</visibilityState>
\t<avatarFull><![CDATA[https://avatars.fastly.steamstatic.com/h_full.jpg]]></avatarFull>
\t<vacBanned>0</vacBanned>
\t<privacyMessage><![CDATA[This profile is private.]]></privacyMessage>
</profile>`;
    const body = await me(a.headers);
    expect(body.profile).toEqual({
      personaName: "Hidden",
      avatarUrl: "https://avatars.fastly.steamstatic.com/h_full.jpg",
      profileUrl: `https://steamcommunity.com/profiles/${STEAM_ID}/`,
      personaState: "offline",
      visibility: "private",
      bans: { vacBans: 0, gameBans: 0, communityBanned: false },
      fetchedAt: body.profile.fetchedAt,
    });
    // Friends-only shows as "friends" even when the Web API reports it as non-public.
    process.env.STEAM_WEB_API_KEY = KEY;
    xml = xml.replace("private</privacyState>", "friendsonly</privacyState>");
    api = {
      GetPlayerSummaries: {
        response: {
          players: [
            {
              steamid: STEAM_ID,
              personaname: "Hidden",
              communityvisibilitystate: 1,
            },
          ],
        },
      },
      GetFriendList: 401,
      GetOwnedGames: { response: {} },
    };
    const forced = await app.inject({
      method: "POST",
      url: "/v1/me/refresh-profile",
      headers: a.headers,
    });
    expect(forced.json().profile.visibility).toBe("friends");
    expect(forced.json().profile.cs2).toBeUndefined();
  });

  it("serves the cached profile when Steam is unreachable and refreshes stale caches", async () => {
    const a = await account();
    expect((await me(a.headers)).profile.personaName).toBe("Fan & Friend");
    await repo.pool.query(
      "update users set steam_profile_fetched_at=now()-interval '7 hours' where id=$1",
      [a.id],
    );
    xml = "fail";
    seen.length = 0;
    const cached = await me(a.headers);
    expect(seen.length).toBeGreaterThan(0); // tried to refresh the stale cache
    expect(cached.profile.personaName).toBe("Fan & Friend");
    // After a failure, Steam is not retried on every request.
    seen.length = 0;
    await me(a.headers);
    expect(seen).toHaveLength(0);
    // Unknown/removed accounts and HTTP errors also keep the cache.
    xml = 503;
    const forced = await app.inject({
      method: "POST",
      url: "/v1/me/refresh-profile",
      headers: a.headers,
    });
    expect(forced.statusCode).toBe(200);
    expect(forced.json().profile.personaName).toBe("Fan & Friend");
    // Without any cache and Steam down there is simply no profile.
    const b = await account("76561198000000077");
    xml = "fail";
    const bare = await me(b.headers);
    expect(bare.steamId).toBe("76561198000000077");
    expect(bare.profile).toBeUndefined();
  });

  it("rate-limits forced refreshes per account", async () => {
    const a = await account();
    const first = await app.inject({
      method: "POST",
      url: "/v1/me/refresh-profile",
      headers: a.headers,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().profile.personaName).toBe("Fan & Friend");
    const second = await app.inject({
      method: "POST",
      url: "/v1/me/refresh-profile",
      headers: a.headers,
    });
    expect(second.statusCode).toBe(429);
    expect(second.json().retryAfterSeconds).toBeGreaterThan(0);
    expect(second.headers["retry-after"]).toBeDefined();
    // Other accounts are not affected; unauthenticated callers are rejected.
    const b = await account(null);
    const other = await app.inject({
      method: "POST",
      url: "/v1/me/refresh-profile",
      headers: b.headers,
    });
    expect(other.statusCode).toBe(200);
    expect(other.json()).toEqual({
      ownerId: b.id,
      role: "user",
      memberSince: expect.any(String),
      plan: expect.objectContaining({ id: "free", source: "default" }),
      usage: expect.objectContaining({ day: expect.any(String) }),
      credits: expect.objectContaining({
        balance: 0,
        welcome: { status: "ineligible", reason: "not_steam" },
      }),
    });
    expect(
      (await app.inject({ method: "POST", url: "/v1/me/refresh-profile" }))
        .statusCode,
    ).toBe(401);
  });

  async function steamSignIn(steamId: string) {
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
    return { authorization: `Bearer ${exchange.json().token as string}` };
  }

  it("refreshes the profile at Steam sign-in and bootstraps admins only from Steam sign-ins", async () => {
    // A dev/local account never becomes admin, even with first-login bootstrap on.
    process.env.ADMIN_BOOTSTRAP = "first-login";
    const dev = await account(null);
    expect((await me(dev.headers)).role).toBe("user");
    const firstHeaders = await steamSignIn("76561198000000101");
    const first = await me(firstHeaders);
    expect(first.role).toBe("admin");
    expect(first.profile.personaName).toBe("Fan & Friend");
    expect(seen).toContain(
      "https://steamcommunity.com/profiles/76561198000000101/?xml=1",
    );
    // Only the first one while an admin exists.
    expect((await me(await steamSignIn("76561198000000102"))).role).toBe(
      "user",
    );
    expect((await me(dev.headers)).role).toBe("user");
    // Explicitly listed Steam IDs are admin at sign-in.
    delete process.env.ADMIN_BOOTSTRAP;
    process.env.ADMIN_STEAM_IDS = " 76561198000000103 , not-an-id";
    expect((await me(await steamSignIn("76561198000000103"))).role).toBe(
      "admin",
    );
    expect((await me(await steamSignIn("76561198000000104"))).role).toBe(
      "user",
    );
    // Without bootstrap settings no-one is promoted.
    delete process.env.ADMIN_STEAM_IDS;
    await repo.pool.query("update users set role='user'");
    expect((await me(await steamSignIn("76561198000000105"))).role).toBe(
      "user",
    );
  });

  it("removes the cached profile with the account", async () => {
    const a = await account();
    await me(a.headers);
    expect(
      (
        await repo.pool.query(
          "select count(*)::int as n from users where id=$1 and steam_profile is not null",
          [a.id],
        )
      ).rows[0].n,
    ).toBe(1);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: "/v1/account",
          headers: a.headers,
        })
      ).statusCode,
    ).toBe(204);
    expect(
      (
        await repo.pool.query(
          "select count(*)::int as n from users where id=$1 or steam_profile::text like '%Fan & Friend%' and steam_id=$2",
          [a.id, STEAM_ID],
        )
      ).rows[0].n,
    ).toBe(0);
  });
});
