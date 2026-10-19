import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ cookie: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.cookie }),
}));
vi.mock("../session", () => ({
  apiUrl: () => "http://api:4000",
  COOKIE: "cs2_owner",
}));
import { GET } from "./authCallback";
beforeEach(() => {
  vi.stubEnv("WEB_ORIGIN", "http://127.0.0.1:3000");
  mocks.cookie.mockReturnValue({ value: "browser-binding" });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("Steam callback browser binding", () => {
  it("exchanges a bound one-time code server-side and issues an HttpOnly owner cookie", async () => {
    const upstream = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ token: "opaque-owner-token" })),
      );
    vi.stubGlobal("fetch", upstream);
    const response = await GET(
      new Request("http://localhost:3000/auth/callback?code=once"),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1:3000/settings?auth=ok#steam",
    );
    const cookie = response.headers.get("set-cookie");
    expect(cookie).toContain("cs2_owner=opaque-owner-token");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=strict");
    expect(cookie).toContain("cs2_steam_exchange=;");
    const [, init] = upstream.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      Cookie: "cs2_steam_exchange=browser-binding",
    });
    expect(init.body).toBe(JSON.stringify({ code: "once" }));
  });
  it("rejects code-only navigation without browser binding before contacting API", async () => {
    mocks.cookie.mockReturnValue(undefined);
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const response = await GET(
      new Request("http://localhost:3000/auth/callback?code=attacker-code"),
    );
    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1:3000/settings?auth=failed#steam",
    );
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(upstream).not.toHaveBeenCalled();
  });
  it("fails closed when the backend rejects an expired or replayed code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 401 })),
    );
    const response = await GET(
      new Request("http://localhost:3000/auth/callback?code=expired"),
    );
    expect(response.headers.get("location")).toContain("auth=failed");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
