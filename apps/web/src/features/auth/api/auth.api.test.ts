import { describe, expect, it } from "vitest";
import { ApiError } from "@/shared/http";
import { FakeHttpClient } from "@/shared/http/FakeHttpClient";
import { createAuthApi } from "./auth.api";

describe("AuthApi", () => {
  it("treats an unreachable session probe as 'maybe signed in'", async () => {
    const web = new FakeHttpClient().on("GET", "session", () => {
      throw new TypeError("offline");
    });
    const api = createAuthApi(new FakeHttpClient(), web, async () => false);
    await expect(api.getSession()).resolves.toEqual({
      hasSession: true,
      devLogin: false,
    });
  });
  it("keeps the JSON body of an error session answer", async () => {
    const web = new FakeHttpClient().on("GET", "session", () => {
      throw new ApiError("x", 500, undefined, undefined, { hasSession: false });
    });
    const api = createAuthApi(new FakeHttpClient(), web, async () => false);
    await expect(api.getSession()).resolves.toEqual({ hasSession: false });
  });
  it("reads the Steam start URL and logs out with a timeout", async () => {
    const http = new FakeHttpClient().on("GET", "auth/steam/start", {
      url: "https://steamcommunity.com/openid",
    });
    const web = new FakeHttpClient().on("POST", "logout", undefined);
    const api = createAuthApi(http, web, async () => false);
    await expect(api.startSteamSignIn()).resolves.toContain("steamcommunity");
    await api.logout();
    expect(web.calls[0]!.options.timeoutMs).toBe(12000);
  });
});
