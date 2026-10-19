import { describe, expect, it } from "vitest";
import { byScope, parsePlan, scopeOf } from "./plan";

describe("plan items", () => {
  it("prefers planItems with scope and map", () => {
    expect(
      parsePlan({
        planItems: [
          { text: " Trade fast ", scope: "general" },
          { text: "Smoke jungle", scope: "map", map: "de_mirage" },
          "Plain string",
          { text: "" },
        ],
        plan: ["ignored"],
      }),
    ).toEqual([
      { text: "Trade fast", scope: "general" },
      { text: "Smoke jungle", scope: "map", map: "de_mirage" },
      { text: "Plain string", scope: "general" },
    ]);
  });
  it("falls back to legacy plan strings", () => {
    expect(parsePlan({ plan: ["a", 3, "b"] })).toEqual([
      { text: "a", scope: "general" },
      { text: "b", scope: "general" },
    ]);
    expect(parsePlan(null)).toEqual([]);
  });
  it("splits by scope", () => {
    const items = [
      { text: "g", scope: "general" as const },
      { text: "m", scope: "map" as const },
    ];
    expect(byScope(items)).toEqual({ general: [items[0]], map: [items[1]] });
    expect(scopeOf("map")).toBe("map");
    expect(scopeOf("x")).toBe("general");
  });
});
