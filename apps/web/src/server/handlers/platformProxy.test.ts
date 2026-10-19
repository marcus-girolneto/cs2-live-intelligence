import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ token: vi.fn(), origin: vi.fn() }));
vi.mock("../session", () => ({
  apiUrl: () => "http://api:4000",
  ownerToken: mocks.token,
  sameOrigin: mocks.origin,
  json: (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
}));
import { GET, POST } from "./platformProxy";
const context = (path: string) => ({
  params: Promise.resolve({ path: path.split("/") }),
});
beforeEach(() => {
  mocks.token.mockResolvedValue("server-owner-token");
  mocks.origin.mockReturnValue(true);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("server owner proxy", () => {
  it("keeps credentials in server headers and forwards raw demo bytes", async () => {
    const upstream = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "job", status: "queued" }), {
        status: 202,
      }),
    );
    vi.stubGlobal("fetch", upstream);
    const response = await POST(
      new Request("http://web/api/platform/demos/uploads", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "x-filename": "match.dem",
        },
        body: new Uint8Array([1, 2, 3]),
      }),
      context("demos/uploads"),
    );
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ id: "job", status: "queued" });
    const [url, init] = upstream.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api:4000/v1/demos/uploads");
    expect(init.headers).toEqual({
      Authorization: "Bearer server-owner-token",
      "Content-Type": "application/octet-stream",
      "x-filename": "match.dem",
    });
    expect(init.body).toEqual(new Uint8Array([1, 2, 3]));
  });
  it("rejects cookie-less protected reads before contacting the API", async () => {
    mocks.token.mockResolvedValue(undefined);
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    expect(
      (await GET(new Request("http://web/api/platform/me"), context("me")))
        .status,
    ).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("rejects cross-origin mutations and collector credential claims", async () => {
    mocks.origin.mockReturnValue(false);
    expect(
      (
        await POST(
          new Request("http://web/api/platform/account", { method: "POST" }),
          context("account"),
        )
      ).status,
    ).toBe(403);
    mocks.origin.mockReturnValue(true);
    expect(
      (
        await POST(
          new Request("http://web/api/platform/devices/claim", {
            method: "POST",
          }),
          context("devices/claim"),
        )
      ).status,
    ).toBe(404);
  });
  it("relays Steam state cookie and preserves upstream error status", async () => {
    mocks.token.mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ url: "https://steamcommunity.com/openid/login" }),
          {
            headers: {
              "Set-Cookie":
                "cs2_steam_state=opaque; HttpOnly; SameSite=Lax; Path=/",
            },
          },
        ),
      ),
    );
    const response = await GET(
      new Request("http://web/api/platform/auth/steam/start"),
      context("auth/steam/start"),
    );
    expect(response.headers.get("Set-Cookie")).toContain(
      "cs2_steam_state=opaque",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Consent required" }), {
          status: 403,
        }),
      ),
    );
    mocks.token.mockResolvedValue("owner");
    expect(
      (
        await POST(
          new Request("http://web/api/platform/demos/uploads", {
            method: "POST",
            body: "bad",
          }),
          context("demos/uploads"),
        )
      ).status,
    ).toBe(403);
  });
  it("forwards the replay window query and serves plans without a session", async () => {
    const upstream = vi
      .fn()
      .mockImplementation(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", upstream);
    await GET(
      new Request(
        "http://web/api/platform/analyses/a1/replay?round=3&from=10&to=24&evil=1",
      ),
      context("analyses/a1/replay"),
    );
    expect(upstream.mock.calls[0]![0]).toBe(
      "http://api:4000/v1/analyses/a1/replay?round=3&from=10&to=24",
    );
    mocks.token.mockResolvedValue(undefined);
    const plans = await GET(
      new Request("http://web/api/platform/plans"),
      context("plans"),
    );
    expect(plans.status).toBe(200);
    expect(upstream.mock.calls[1]![1].headers.Authorization).toBeUndefined();
    const status = await GET(
      new Request("http://web/api/platform/billing/status"),
      context("billing/status"),
    );
    expect(status.status).toBe(401);
    const hook = await POST(
      new Request("http://web/api/platform/billing/webhook", {
        method: "POST",
        body: "{}",
      }),
      context("billing/webhook"),
    );
    expect(hook.status).toBe(404);
  });
});
