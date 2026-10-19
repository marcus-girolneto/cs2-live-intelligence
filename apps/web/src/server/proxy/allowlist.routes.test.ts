import { describe, expect, it } from "vitest";
import { allowedProxy, forwardQuery, isAiRoute } from "./allowlist";

describe("proxy routes for identity, ownership and team features", () => {
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
