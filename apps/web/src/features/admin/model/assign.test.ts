import { describe, expect, it } from "vitest";
import {
  checkModel,
  effectiveSource,
  estimateCost,
  normalizeModels,
} from "./assign";

describe("normalizeModels", () => {
  it("reads string lists and priced objects", () => {
    const c = normalizeModels({
      supported: true,
      models: [
        "a",
        "a",
        { id: "b", pricing: { prompt: "0.000001", completion: "0.000002" } },
        { id: "c", pricing: { inputPer1M: 3, outputPer1M: 15 } },
        { id: "d", pricing: { prompt: "x" } },
        { nope: 1 },
      ],
    });
    expect(c.listed).toBe(true);
    expect(c.models).toEqual([
      { id: "a", price: null },
      { id: "b", price: { input: 1, output: 2 } },
      { id: "c", price: { input: 3, output: 15 } },
      { id: "d", price: null },
    ]);
  });
  it("marks providers without a list for manual entry", () => {
    expect(
      normalizeModels({ supported: false, models: [], error: "nope" }),
    ).toEqual({
      listed: false,
      models: [],
      error: "nope",
    });
    expect(normalizeModels(null).listed).toBe(false);
  });
});

describe("assignment checks", () => {
  const cat = normalizeModels({ models: ["gpt-x"] });
  it("validates against the fetched list, or allows manual entry", () => {
    expect(checkModel("gpt-x", cat)).toBe("ok");
    expect(checkModel("gpt-y", cat)).toBe("unknown");
    expect(checkModel(" ", cat)).toBe("empty");
    expect(checkModel("anything", undefined)).toBe("manual");
    expect(checkModel("anything", normalizeModels({ supported: false }))).toBe(
      "manual",
    );
  });
  it("estimates cost per call at list price", () => {
    expect(estimateCost("review_quick", null)).toBeNull();
    expect(estimateCost("review_quick", { input: 1, output: 2 })).toBeCloseTo(
      0.015,
    );
  });
  it("explains fallbacks and env defaults", () => {
    const a = { review_quick: { providerId: "p", model: "m" } };
    expect(effectiveSource("review_quick", a)).toEqual({ kind: "own" });
    expect(effectiveSource("personal_coach", a)).toEqual({
      kind: "fallback",
      from: "review_quick",
    });
    expect(effectiveSource("live", a)).toEqual({ kind: "env" });
    expect(
      effectiveSource("live", {}, { configured: false, reason: "missing" }),
    ).toEqual({ kind: "none" });
    expect(
      effectiveSource("review_deep", {
        review: { providerId: "p", model: "m" },
      }),
    ).toEqual({
      kind: "fallback",
      from: "review_quick",
    });
  });
});
