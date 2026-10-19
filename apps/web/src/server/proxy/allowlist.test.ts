import { describe, expect, it } from "vitest";
import {
  AI_PROXY_TIMEOUT_MS,
  allowedProxy,
  cappedBody,
  forwardQuery,
  isAiRoute,
  PUBLIC_ROUTES,
} from "./allowlist";
describe("authenticated proxy boundary", () => {
  it("allows only exact supported routes and HTTP verbs", () => {
    expect(allowedProxy("GET", "matches")).toBe(true);
    expect(allowedProxy("GET", "matches/abc-123")).toBe(true);
    expect(allowedProxy("POST", "devices/a_1/rotate")).toBe(true);
    expect(allowedProxy("POST", "devices/claim")).toBe(false);
    expect(allowedProxy("GET", "auth/exchange")).toBe(false);
    expect(allowedProxy("GET", "../admin")).toBe(false);
    expect(allowedProxy("POST", "matches")).toBe(false);
    expect(allowedProxy("GET", "matches/a/extra")).toBe(false);
  });
  it("rejects declared oversized bodies before reading them", async () => {
    const request = new Request("http://localhost/upload", {
      method: "POST",
      headers: { "Content-Length": "9" },
      body: "tiny",
    });
    await expect(cappedBody(request, 8)).rejects.toThrow("Payload too large");
  });
  it("caps actual streamed bodies even without Content-Length", async () => {
    const request = new Request("http://localhost/upload", {
      method: "POST",
      body: "123456789",
    });
    await expect(cappedBody(request, 8)).rejects.toThrow("Payload too large");
  });
  it("preserves exact accepted bytes", async () => {
    const request = new Request("http://localhost/upload", {
      method: "POST",
      body: new Uint8Array([0, 1, 255]),
    });
    expect(await cappedBody(request, 3)).toEqual(new Uint8Array([0, 1, 255]));
  });
  it("allows AI routes with a long timeout only for them", () => {
    expect(allowedProxy("GET", "ai/status")).toBe(true);
    expect(allowedProxy("POST", "ai/test")).toBe(true);
    expect(allowedProxy("POST", "analyses/abc-1/coaching")).toBe(true);
    expect(allowedProxy("GET", "ai/test")).toBe(false);
    expect(allowedProxy("POST", "ai/status")).toBe(false);
    expect(allowedProxy("POST", "analyses/../coaching")).toBe(false);
    expect(allowedProxy("POST", "ai/live-call")).toBe(true);
    expect(allowedProxy("PUT", "coach/profile")).toBe(true);
    expect(allowedProxy("GET", "coach/progress")).toBe(true);
    expect(allowedProxy("POST", "coach/reviews/abc/rating")).toBe(true);
    expect(allowedProxy("DELETE", "coach/profile")).toBe(false);
    expect(allowedProxy("POST", "demos/sample")).toBe(true);
    expect(isAiRoute("ai/live-call")).toBe(true);
    expect(isAiRoute("ai/test")).toBe(true);
    expect(isAiRoute("analyses/abc/coaching")).toBe(true);
    expect(isAiRoute("matches")).toBe(false);
    expect(AI_PROXY_TIMEOUT_MS).toBeGreaterThanOrEqual(5 * 60 * 1000);
  });
  it("allows the profile refresh and the exact admin routes", () => {
    expect(allowedProxy("GET", "me")).toBe(true);
    expect(allowedProxy("POST", "me/refresh-profile")).toBe(true);
    expect(allowedProxy("GET", "me/refresh-profile")).toBe(false);
    const ok: [string, string][] = [
      ["GET", "admin/ai/providers"],
      ["POST", "admin/ai/providers"],
      ["PUT", "admin/ai/providers/3f2c-a1"],
      ["DELETE", "admin/ai/providers/3f2c-a1"],
      ["POST", "admin/ai/providers/3f2c-a1/test"],
      ["GET", "admin/ai/providers/3f2c-a1/models"],
      ["GET", "admin/ai/assignments"],
      ["PUT", "admin/ai/assignments"],
      ["GET", "admin/settings"],
      ["PUT", "admin/settings"],
      ["GET", "admin/users"],
      ["PUT", "admin/users/dev-owner/role"],
      ["GET", "admin/audit"],
      ["POST", "admin/analyses/reprocess"],
    ];
    for (const [verb, path] of ok)
      expect(allowedProxy(verb, path), path).toBe(true);
    const denied: [string, string][] = [
      ["DELETE", "admin/ai/providers"],
      ["GET", "admin/ai/providers/x/test"],
      ["POST", "admin/ai/providers/x/models"],
      ["POST", "admin/settings"],
      ["DELETE", "admin/users/x"],
      ["GET", "admin/users/x/role"],
      ["POST", "admin/audit"],
      ["PUT", "admin/ai/providers/../x"],
      ["GET", "admin/secrets"],
      ["GET", "admin/analyses/reprocess"],
      ["POST", "admin/analyses/x/reprocess"],
    ];
    for (const [verb, path] of denied)
      expect(allowedProxy(verb, path), `${verb} ${path}`).toBe(false);
    expect(isAiRoute("admin/ai/providers/x/test")).toBe(true);
    expect(isAiRoute("admin/ai/providers/x/models")).toBe(true);
    expect(isAiRoute("admin/settings")).toBe(false);
  });
  it("forwards only allowed numeric query parameters", () => {
    expect(forwardQuery("admin/audit", new URLSearchParams("limit=50"))).toBe(
      "?limit=50",
    );
    expect(
      forwardQuery("admin/audit", new URLSearchParams("limit=1;drop&x=1")),
    ).toBe("");
    expect(forwardQuery("matches", new URLSearchParams("limit=5"))).toBe("");
  });
  it("allows the replay routes and forwards only numeric round/from/to", () => {
    expect(allowedProxy("GET", "analyses/abc-1/replay/meta")).toBe(true);
    expect(allowedProxy("GET", "analyses/abc-1/replay")).toBe(true);
    expect(allowedProxy("POST", "analyses/abc-1/replay")).toBe(false);
    expect(allowedProxy("GET", "analyses/../replay")).toBe(false);
    expect(allowedProxy("GET", "analyses/abc/replay/other")).toBe(false);
    expect(
      forwardQuery(
        "analyses/abc-1/replay",
        new URLSearchParams("round=3&from=10.5&to=24&x=1"),
      ),
    ).toBe("?round=3&from=10.5&to=24");
    expect(
      forwardQuery(
        "analyses/abc-1/replay",
        new URLSearchParams("round=3;drop&from=-1&to=1e9"),
      ),
    ).toBe("");
    expect(
      forwardQuery(
        "analyses/abc-1/replay/meta",
        new URLSearchParams("round=3"),
      ),
    ).toBe("");
    expect(isAiRoute("analyses/abc/replay")).toBe(false);
  });
  it("allows plans and billing but never the Stripe webhook", () => {
    const ok: [string, string][] = [
      ["GET", "plans"],
      ["GET", "billing/status"],
      ["POST", "billing/checkout"],
      ["POST", "billing/portal"],
      ["GET", "admin/plans"],
      ["PUT", "admin/plans"],
      ["PUT", "admin/users/u-1/plan"],
    ];
    for (const [verb, path] of ok)
      expect(allowedProxy(verb, path), `${verb} ${path}`).toBe(true);
    const denied: [string, string][] = [
      ["POST", "billing/webhook"],
      ["GET", "billing/webhook"],
      ["POST", "plans"],
      ["GET", "billing/checkout"],
      ["DELETE", "admin/plans"],
      ["GET", "admin/users/u-1/plan"],
      ["PUT", "admin/users/../plan"],
    ];
    for (const [verb, path] of denied)
      expect(allowedProxy(verb, path), `${verb} ${path}`).toBe(false);
    expect(PUBLIC_ROUTES.has("plans")).toBe(true);
    expect(PUBLIC_ROUTES.has("billing/status")).toBe(false);
  });
});
