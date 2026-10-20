import { describe, expect, it } from "vitest";
import { RuntimeEnv } from "../../src/config/env.js";
import type {
  OpenIdVerdict,
  SteamOpenIdVerifier,
  SteamProfileProvider,
} from "../../src/infrastructure/steam/http-steam-client.js";
import type { SteamProfile } from "../../src/infrastructure/steam/steam-profile.types.js";
import type {
  AuthRepository,
  LoginCode,
} from "../../src/modules/auth/auth.repository.js";
import { AuthService } from "../../src/modules/auth/auth.service.js";
import {
  parseSteamAssertion,
  steamCallbackUrl,
} from "../../src/modules/auth/openid.js";
import type {
  AccountRecord,
  UsersRepository,
} from "../../src/modules/users/users.repository.js";
import {
  PROFILE_MAX_AGE_MS,
  UsersService,
} from "../../src/modules/users/users.service.js";
import type { AdminBootstrap } from "../../src/config/env.js";
import { appError, RecordingInvalidation } from "./fakes.js";

const STEAM = "76561198000000001";
const T0 = Date.parse("2026-10-19T12:00:00Z");

class FakeUsers implements UsersRepository {
  fetchedAt: Date | null = null;
  profile: unknown = null;
  saves = 0;
  lang: AccountRecord["lang"] = null;
  async role() {
    return "user" as const;
  }
  async account(ownerId: string): Promise<AccountRecord> {
    return {
      ownerId,
      role: "user",
      steamId: STEAM,
      steamProfile: this.profile,
      steamProfileFetchedAt: this.fetchedAt,
      lang: this.lang,
    };
  }
  async setLanguage(_o: string, lang: NonNullable<AccountRecord["lang"]>) {
    this.lang = lang;
  }
  async saveSteamProfile(_o: string, p: SteamProfile) {
    this.saves++;
    this.profile = p;
    this.fetchedAt = new Date(p.fetchedAt);
  }
}
class FakeSteam implements SteamProfileProvider {
  calls = 0;
  fail = false;
  constructor(private readonly now: () => number) {}
  async profile(): Promise<SteamProfile | null> {
    this.calls++;
    return this.fail
      ? null
      : {
          personaName: "fan",
          visibility: "public",
          fetchedAt: new Date(this.now()).toISOString(),
        };
  }
}

describe("UsersService profile refresh policy", () => {
  const setup = () => {
    let now = T0;
    const users = new FakeUsers();
    const steam = new FakeSteam(() => now);
    const service = new UsersService(
      users,
      steam,
      { extras: async () => ({ plan: "free" }) },
      () => now,
    );
    return { users, steam, service, advance: (ms: number) => (now += ms) };
  };
  it("refreshes a missing/stale cache and serves the cache while fresh", async () => {
    const { users, steam, service, advance } = setup();
    expect(await service.me("o")).toMatchObject({
      steamId: STEAM,
      profile: { personaName: "fan" },
      plan: "free",
    });
    expect(steam.calls).toBe(1);
    await service.me("o");
    expect(steam.calls).toBe(1);
    advance(PROFILE_MAX_AGE_MS + 1);
    await service.me("o");
    expect(steam.calls).toBe(2);
    expect(users.saves).toBe(2);
  });
  it("does not retry Steam within a minute of a failure", async () => {
    const { steam, service, advance } = setup();
    steam.fail = true;
    expect((await service.me("o")).profile).toBeUndefined();
    await service.me("o");
    expect(steam.calls).toBe(1);
    advance(61_000);
    await service.me("o");
    expect(steam.calls).toBe(2);
  });
  it("rate limits forced refreshes with retry-after", async () => {
    const { steam, service, advance } = setup();
    await service.refresh("o");
    advance(15_000);
    const err = await appError(service.refresh("o"));
    expect(err).toMatchObject({
      status: 429,
      body: { retryAfterSeconds: 45 },
      headers: { "retry-after": "45" },
    });
    advance(45_000);
    await service.refresh("o");
    expect(steam.calls).toBe(2);
  });
});

const API = "https://api.example";
function assertion(over: Record<string, string> = {}, now = T0) {
  const state = "state-123";
  return {
    state,
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "id_res",
    "openid.op_endpoint": "https://steamcommunity.com/openid/login",
    "openid.return_to": steamCallbackUrl(API, state),
    "openid.claimed_id": `https://steamcommunity.com/openid/id/${STEAM}`,
    "openid.identity": `https://steamcommunity.com/openid/id/${STEAM}`,
    "openid.response_nonce": new Date(now).toISOString().slice(0, 19) + "Zabc",
    "openid.assoc_handle": "h",
    "openid.signed":
      "op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle",
    "openid.sig": "s",
    ...over,
  };
}

describe("parseSteamAssertion", () => {
  it("accepts a well-formed assertion and prepares check_authentication", () => {
    const parsed = parseSteamAssertion(assertion(), "state-123", API, T0);
    expect(parsed).toMatchObject({ steamId: STEAM, state: "state-123" });
    expect(parsed?.verification.get("openid.mode")).toBe(
      "check_authentication",
    );
  });
  it("rejects state mismatch, foreign endpoints, stale nonces and unsigned fields", () => {
    expect(
      parseSteamAssertion(assertion(), "other-state", API, T0),
    ).toBeUndefined();
    expect(
      parseSteamAssertion(assertion(), undefined, API, T0),
    ).toBeUndefined();
    expect(
      parseSteamAssertion(
        assertion({ "openid.op_endpoint": "https://evil/openid" }),
        "state-123",
        API,
        T0,
      ),
    ).toBeUndefined();
    expect(
      parseSteamAssertion(
        assertion({
          "openid.identity":
            "https://steamcommunity.com/openid/id/76561198000000002",
        }),
        "state-123",
        API,
        T0,
      ),
    ).toBeUndefined();
    expect(
      parseSteamAssertion(assertion({}, T0 - 301_000), "state-123", API, T0),
    ).toBeUndefined();
    expect(
      parseSteamAssertion(
        assertion({ "openid.signed": "claimed_id,identity" }),
        "state-123",
        API,
        T0,
      ),
    ).toBeUndefined();
  });
});

class FakeAuth implements AuthRepository {
  admin: AdminBootstrap | undefined;
  loggedOut: string[] = [];
  async ownerForToken() {
    return undefined;
  }
  async logout(token: string) {
    this.loggedOut.push(token);
    return "o";
  }
  async createOpenIdState() {
    return "state-123";
  }
  async finishOpenId(
    _s: string,
    _n: string,
    _id: string,
    admin: AdminBootstrap,
  ): Promise<LoginCode> {
    this.admin = admin;
    return { code: "code", binding: "bind", ownerId: "o" };
  }
  async exchange() {
    return { token: "t" };
  }
}

describe("AuthService", () => {
  const setup = (verdict: OpenIdVerdict) => {
    const repo = new FakeAuth();
    const refreshed: string[] = [];
    const invalidation = new RecordingInvalidation();
    const verifier: SteamOpenIdVerifier = { verify: async () => verdict };
    const env = new RuntimeEnv(() => ({
      ADMIN_STEAM_IDS: `${STEAM}, junk`,
      ADMIN_BOOTSTRAP: "first-login",
    }));
    const service = new AuthService(
      repo,
      verifier,
      { refreshInBackground: (o, s) => refreshed.push(`${o}:${s}`) },
      invalidation,
      env,
      API,
      () => T0,
    );
    return { repo, refreshed, invalidation, service };
  };
  it("issues a login code, passes the admin bootstrap and refreshes the profile", async () => {
    const { repo, refreshed, service } = setup("valid");
    expect((await service.startSteamLogin()).url).toContain(
      "openid.return_to=",
    );
    expect(await service.completeSteamLogin(assertion(), "state-123")).toEqual({
      status: "ok",
      code: "code",
      binding: "bind",
    });
    expect([...(repo.admin?.steamIds ?? [])]).toEqual([STEAM]);
    expect(repo.admin?.firstLogin).toBe(true);
    expect(refreshed).toEqual([`o:${STEAM}`]);
  });
  it("maps Steam's verdicts", async () => {
    expect(
      (
        await setup("unavailable").service.completeSteamLogin(
          assertion(),
          "state-123",
        )
      ).status,
    ).toBe("unavailable");
    expect(
      (
        await setup("invalid").service.completeSteamLogin(
          assertion(),
          "state-123",
        )
      ).status,
    ).toBe("rejected");
    expect(
      (await setup("valid").service.completeSteamLogin(assertion(), "wrong"))
        .status,
    ).toBe("rejected");
  });
  it("logout revokes the token and invalidates the owner", async () => {
    const { repo, invalidation, service } = setup("valid");
    await service.logout("tok", "o");
    expect(repo.loggedOut).toEqual(["tok"]);
    expect(invalidation.owners).toEqual(["o"]);
  });
});
