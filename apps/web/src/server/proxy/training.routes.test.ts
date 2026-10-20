import { describe, expect, it } from "vitest";
import { allowedProxy, forwardQuery, isAiRoute } from "./allowlist";

describe("proxy routes for training", () => {
  it("allows the catalog, recommendations and per-match plans (GET only)", () => {
    expect(allowedProxy("GET", "training/catalog")).toBe(true);
    expect(allowedProxy("GET", "training/recommended")).toBe(true);
    expect(allowedProxy("GET", "analyses/a1/training")).toBe(true);
    expect(allowedProxy("POST", "training/catalog")).toBe(false);
    expect(allowedProxy("POST", "analyses/a1/training")).toBe(false);
    expect(allowedProxy("GET", "training")).toBe(false);
    expect(allowedProxy("GET", "analyses/a1/training/x")).toBe(false);
    expect(allowedProxy("GET", "analyses/../training")).toBe(false);
    expect(isAiRoute("analyses/a1/training")).toBe(false);
  });
  it("forwards only a safe steamId to the per-match plan", () => {
    expect(
      forwardQuery(
        "analyses/a1/training",
        new URLSearchParams("steamId=765611&x=1"),
      ),
    ).toBe("?steamId=765611");
    expect(
      forwardQuery("analyses/a1/training", new URLSearchParams("steamId=a;b")),
    ).toBe("");
    expect(
      forwardQuery("training/catalog", new URLSearchParams("steamId=1")),
    ).toBe("");
  });
});
