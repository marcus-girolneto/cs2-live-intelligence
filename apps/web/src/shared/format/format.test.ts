import { describe, expect, it } from "vitest";
import { finite, formatDate, formatNumber, mapName, ratio } from "./format";
describe("display validation", () => {
  it("rejects non-finite numbers", () => {
    for (const bad of [NaN, Infinity, -Infinity, null, undefined, "3"])
      expect(finite(bad)).toBeNull();
    expect(finite(0)).toBe(0);
    expect(formatNumber(NaN)).toBeNull();
    expect(formatNumber(120.7, 1)).toBe("120.7");
    expect(formatNumber(120.7, 1, "pt-BR")).toBe("120,7");
  });
  it("guards ratios and dates", () => {
    expect(ratio(1, 0)).toBeNull();
    expect(ratio(11, 5)).toBe(2.2);
    expect(formatDate("not a date")).toBeNull();
    expect(formatDate(undefined)).toBeNull();
  });
  it("names maps", () => {
    expect(mapName("de_mirage")).toBe("Mirage");
    expect(mapName("")).toBeNull();
  });
});
