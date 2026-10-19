import { describe, expect, it } from "vitest";
import {
  AI_PROXY_TIMEOUT_MS,
  allowedProxy,
  cappedBody,
  cappedStream,
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
  it("streams accepted bytes through unchanged", async () => {
    const request = new Request("http://localhost/upload", {
      method: "POST",
      body: new Uint8Array([0, 1, 255]),
    });
    const s = cappedStream(request, 3);
    const out = new Uint8Array(await new Response(s.body).arrayBuffer());
    expect(out).toEqual(new Uint8Array([0, 1, 255]));
    expect(s.exceeded()).toBe(false);
  });
  it("cuts a streamed body as soon as it passes the cap", async () => {
    const chunks = [new Uint8Array(5), new Uint8Array(5), new Uint8Array(5)];
    let pulled = 0;
    const source = new ReadableStream<Uint8Array>({
      pull(c) {
        const next = chunks[pulled++];
        if (next) c.enqueue(next);
        else c.close();
      },
    });
    const request = new Request("http://localhost/upload", {
      method: "POST",
      body: source,
      // @ts-expect-error -- Node's fetch needs duplex for stream bodies.
      duplex: "half",
    });
    const s = cappedStream(request, 8);
    await expect(new Response(s.body).arrayBuffer()).rejects.toThrow(
      "Payload too large",
    );
    expect(s.exceeded()).toBe(true);
    // It stopped reading right after the chunk that crossed the limit.
    expect(pulled).toBeLessThan(chunks.length + 1);
  });
  it("rejects a declared oversized stream before reading it", () => {
    const request = new Request("http://localhost/upload", {
      method: "POST",
      headers: { "Content-Length": "9" },
      body: "tiny",
    });
    expect(() => cappedStream(request, 8)).toThrow("Payload too large");
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
      ["POST", "admin/ai/test"],
      ["GET", "admin/integrations"],
      ["PUT", "admin/integrations/steam"],
      ["PUT", "admin/integrations/stripe"],
      ["POST", "admin/integrations/steam/test"],
      ["POST", "admin/integrations/stripe/test"],
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
  it("allows the credit, review-tier, reel and report routes with exact verbs", () => {
    const ok: [string, string][] = [
      ["GET", "analyses/abc-1/reviews"],
      ["GET", "analyses/abc-1/reel"],
      ["POST", "analyses/abc-1/coaching"],
      ["GET", "credits/ledger"],
      ["GET", "credits/packs"],
      ["POST", "billing/credits/checkout"],
      ["GET", "reports"],
      ["GET", "reports/r-2026-10"],
      ["POST", "reports/generate"],
      ["GET", "coach/personal"],
      ["POST", "coach/personal/generate"],
      ["GET", "admin/credits/settings"],
      ["PUT", "admin/credits/settings"],
      ["GET", "admin/credits/packs"],
      ["PUT", "admin/credits/packs"],
      ["GET", "admin/users/u-1/ledger"],
      ["POST", "admin/users/u-1/credits"],
    ];
    for (const [verb, path] of ok)
      expect(allowedProxy(verb, path), `${verb} ${path}`).toBe(true);
    const denied: [string, string][] = [
      ["POST", "analyses/abc/reviews"],
      ["DELETE", "analyses/abc/reviews"],
      ["POST", "analyses/abc/reel"],
      ["GET", "analyses/../reel"],
      ["POST", "credits/ledger"],
      ["POST", "credits/packs"],
      ["GET", "billing/credits/checkout"],
      ["POST", "credits/grant"],
      ["POST", "reports"],
      ["POST", "coach/personal"],
      ["GET", "coach/personal/generate"],
      ["DELETE", "reports/r1"],
      ["GET", "reports/r1/extra"],
      ["POST", "admin/credits/settings"],
      ["DELETE", "admin/credits/packs"],
      ["PUT", "admin/users/u-1/credits"],
      ["GET", "admin/users/u-1/credits"],
      ["POST", "admin/users/../credits"],
      ["POST", "admin/users/u-1/ledger"],
    ];
    for (const [verb, path] of denied)
      expect(allowedProxy(verb, path), `${verb} ${path}`).toBe(false);
    expect(isAiRoute("reports/generate")).toBe(true);
    expect(isAiRoute("reports")).toBe(false);
    expect(isAiRoute("coach/personal/generate")).toBe(true);
    expect(isAiRoute("coach/personal")).toBe(false);
    expect(isAiRoute("analyses/abc/reviews")).toBe(false);
    expect(isAiRoute("billing/credits/checkout")).toBe(false);
    expect(PUBLIC_ROUTES.has("credits/packs")).toBe(true);
    expect(PUBLIC_ROUTES.has("credits/ledger")).toBe(false);
  });
  it("forwards only a safe steamId to reviews/reel and numeric ledger limits", () => {
    expect(
      forwardQuery(
        "analyses/a1/reviews",
        new URLSearchParams("steamId=76561197964020430&x=1"),
      ),
    ).toBe("?steamId=76561197964020430");
    expect(
      forwardQuery("analyses/a1/reel", new URLSearchParams("steamId=a%26b")),
    ).toBe("");
    expect(
      forwardQuery("credits/ledger", new URLSearchParams("limit=20&x=2")),
    ).toBe("?limit=20");
    expect(
      forwardQuery("admin/users/u1/ledger", new URLSearchParams("limit=abc")),
    ).toBe("");
    expect(
      forwardQuery("analyses/a1/coaching", new URLSearchParams("steamId=1")),
    ).toBe("");
  });
  it("rejects unknown integrations and wrong verbs", () => {
    expect(allowedProxy("PUT", "admin/integrations/github")).toBe(false);
    expect(allowedProxy("DELETE", "admin/integrations/steam")).toBe(false);
    expect(allowedProxy("GET", "admin/integrations/stripe/test")).toBe(false);
    expect(allowedProxy("POST", "admin/integrations")).toBe(false);
  });
  it("allows identity, ownership, team review, lobby, integrity and admin status routes", () => {
    for (const [verb, path] of [
      ["PUT", "coach/identity"],
      ["GET", "matches/ownership"],
      ["PATCH", "matches/j1/ownership"],
      ["GET", "matches/auto-reviews"],
      ["POST", "analyses/a1/team-review"],
      ["GET", "analyses/a1/team-reviews"],
      ["GET", "analyses/a1/lobby"],
      ["GET", "analyses/a1/integrity"],
      ["GET", "admin/analyses/reprocess/status"],
      ["GET", "admin/ai/ratings"],
      ["GET", "admin/ai/eval/latest"],
    ] as const)
      expect(allowedProxy(verb, path), `${verb} ${path}`).toBe(true);
    expect(allowedProxy("GET", "coach/identity")).toBe(false);
    expect(allowedProxy("PUT", "matches/j1/ownership")).toBe(false);
    expect(allowedProxy("PATCH", "matches/j1")).toBe(false);
    expect(allowedProxy("GET", "analyses/a1/team-review")).toBe(false);
    expect(allowedProxy("POST", "analyses/a1/integrity")).toBe(false);
    expect(allowedProxy("POST", "admin/ai/eval/latest")).toBe(false);
    expect(isAiRoute("analyses/a1/team-review")).toBe(true);
    expect(isAiRoute("analyses/a1/team-reviews")).toBe(false);
  });
  it("forwards only safe map, ids and steamId query values", () => {
    expect(
      forwardQuery("coach/progress", new URLSearchParams("map=de_mirage&x=1")),
    ).toBe("?map=de_mirage");
    expect(
      forwardQuery("coach/progress", new URLSearchParams("map=../etc")),
    ).toBe("");
    expect(
      forwardQuery("matches/ownership", new URLSearchParams("ids=j1,j_2,j-3")),
    ).toBe("?ids=j1%2Cj_2%2Cj-3");
    expect(
      forwardQuery("matches/auto-reviews", new URLSearchParams("ids=j1;drop")),
    ).toBe("");
    expect(
      forwardQuery("analyses/a1/lobby", new URLSearchParams("steamId=765")),
    ).toBe("?steamId=765");
    expect(
      forwardQuery(
        "analyses/a1/team-reviews",
        new URLSearchParams("steamId=7&a=1"),
      ),
    ).toBe("?steamId=7");
    expect(
      forwardQuery("analyses/a1/integrity", new URLSearchParams("steamId=7")),
    ).toBe("");
  });
});
