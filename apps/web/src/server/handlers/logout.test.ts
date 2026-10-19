import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ token: vi.fn(), origin: vi.fn() }));
vi.mock("../session", async () => {
  const { NextResponse } = await import("next/server");
  return {
    apiUrl: () => "http://api:4000",
    COOKIE: "cs2_owner",
    ownerToken: mocks.token,
    sameOrigin: mocks.origin,
    json: (body: unknown, status = 200) => NextResponse.json(body, { status }),
  };
});
import { POST } from "./logout";
beforeEach(() => {
  mocks.token.mockResolvedValue("owner-session");
  mocks.origin.mockReturnValue(true);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("server session logout", () => {
  it("revokes the upstream bearer before clearing HttpOnly cookie", async () => {
    const upstream = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", upstream);
    const result = await POST(
      new Request("http://web/api/logout", { method: "POST" }),
    );
    expect(result.status).toBe(200);
    expect(result.headers.get("set-cookie")).toContain("cs2_owner=;");
    expect(upstream).toHaveBeenCalledWith(
      "http://api:4000/v1/auth/logout",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer owner-session" },
      }),
    );
  });
  it("retains cookie and reports failure when session revocation is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network unavailable")),
    );
    const result = await POST(
      new Request("http://web/api/logout", { method: "POST" }),
    );
    expect(result.status).toBe(502);
    expect(result.headers.get("set-cookie")).toBeNull();
  });
  it("allows clearing a previously expired session but rejects cross-origin logout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );
    expect(
      (
        await POST(new Request("http://web/api/logout", { method: "POST" }))
      ).headers.get("set-cookie"),
    ).toContain("cs2_owner=;");
    mocks.origin.mockReturnValue(false);
    expect(
      (await POST(new Request("http://web/api/logout", { method: "POST" })))
        .status,
    ).toBe(403);
  });
});
