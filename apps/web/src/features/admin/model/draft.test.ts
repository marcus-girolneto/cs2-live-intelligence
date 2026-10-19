import { describe, expect, it } from "vitest";
import { DEFAULT_PLANS } from "@/features/billing";
import { money, parseLimit, parseMoney, setLimit } from "./draft";

describe("plan editor parsing", () => {
  it("parses limits, money and keeps plans immutable", () => {
    expect(parseLimit("")).toBeNull();
    expect(parseLimit("3")).toBe(3);
    expect(parseLimit("-1")).toBeUndefined();
    expect(parseLimit("1.5")).toBeUndefined();
    expect(parseMoney("14,90")).toBe(1490);
    expect(parseMoney("4.99")).toBe(499);
    expect(parseMoney("x")).toBeUndefined();
    expect(money(29900)).toBe("299.00");
    const next = setLimit(DEFAULT_PLANS[0]!, "uploadsPerDay", null);
    expect(next.limits.uploadsPerDay).toBeNull();
    expect(DEFAULT_PLANS[0]!.limits.uploadsPerDay).toBe(2);
  });
});
