import { describe, expect, it } from "vitest";
import { allowedProxy, forwardQuery, isAiRoute } from "./allowlist";

describe("proxy routes for Settings → Developers", () => {
  it("allows the session-auth API key and webhook management routes only", () => {
    for (const [verb, path] of [
      ["GET", "me/api-keys"],
      ["POST", "me/api-keys"],
      ["DELETE", "me/api-keys/2b1c7f0e-1111-4c2d-9e3f-000000000001"],
      ["GET", "me/webhooks"],
      ["POST", "me/webhooks"],
      ["GET", "me/webhooks/deliveries"],
      ["DELETE", "me/webhooks/w1"],
      ["POST", "me/webhooks/w1/test"],
    ] as const)
      expect(allowedProxy(verb, path), `${verb} ${path}`).toBe(true);
    expect(allowedProxy("PUT", "me/api-keys/k1")).toBe(false);
    expect(allowedProxy("GET", "me/api-keys/k1")).toBe(false);
    expect(allowedProxy("POST", "me/webhooks/w1")).toBe(false);
    expect(allowedProxy("DELETE", "me/webhooks/../account")).toBe(false);
    expect(isAiRoute("me/webhooks/w1/test")).toBe(false);
  });
  it("never proxies the public API (it is called on the API with an API key)", () => {
    for (const path of ["api/v1/demos", "v1/demos", "demos", "api/v1/me"])
      for (const verb of ["GET", "POST", "DELETE"])
        expect(allowedProxy(verb, path), `${verb} ${path}`).toBe(false);
  });
  it("forwards only a numeric limit and a UUID webhookId for deliveries", () => {
    expect(
      forwardQuery(
        "me/webhooks/deliveries",
        new URLSearchParams(
          "limit=5&webhookId=2b1c7f0e-1111-4c2d-9e3f-000000000001&x=1",
        ),
      ),
    ).toBe("?limit=5&webhookId=2b1c7f0e-1111-4c2d-9e3f-000000000001");
    expect(
      forwardQuery(
        "me/webhooks/deliveries",
        new URLSearchParams("webhookId=x;drop"),
      ),
    ).toBe("");
  });
});
