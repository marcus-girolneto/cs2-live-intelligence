import { describe, expect, it } from "vitest";
import { ApiError } from "@/shared/http";
import {
  daysUntil,
  insufficientFrom,
  normalizeCredits,
  normalizeLedger,
  normalizePacks,
  reasonLabel,
  tierCost,
} from "./credits";
import { normalizePlans, planUpdateBody } from "./normalize";
import { welcomeCopy } from "./welcome";

describe("credits", () => {
  it("normalizes balance, buckets, costs and the welcome grant", () => {
    const c = normalizeCredits({
      balance: 6,
      buckets: { plan: 3, bonus: 1, purchased: 2 },
      planExpiresAt: "2026-11-01T00:00:00Z",
      welcome: { status: "ineligible", reason: "profile_private" },
      costs: { quick: 1, deep: 2 },
    })!;
    expect(c.balance).toBe(6);
    expect(c.buckets).toEqual({ plan: 3, bonus: 1, purchased: 2 });
    expect(c.costs).toEqual({ quick: 1, deep: 2 });
    expect(c.welcome).toEqual({
      status: "ineligible",
      reason: "profile_private",
    });
    expect(c.planExpiresAt).toBe("2026-11-01T00:00:00Z");
  });
  it("is defensive: missing pieces fall back, garbage never leaks", () => {
    expect(normalizeCredits(undefined)).toBeNull();
    const c = normalizeCredits({
      buckets: { plan: "x", bonus: 2, purchased: NaN },
      planExpiresAt: "nope",
      welcome: { status: "ineligible", reason: "secret_rule" },
    })!;
    expect(c.balance).toBe(2);
    expect(c.costs).toEqual({ quick: 1, deep: 3 });
    expect(c.planExpiresAt).toBeUndefined();
    expect(c.welcome).toEqual({ status: "ineligible", reason: null });
  });
  it("prices tiers from the API, else from the plan (Pro pays 2 for Deep)", () => {
    expect(tierCost(null, "deep", { id: "pro" })).toBe(2);
    expect(tierCost(null, "deep", { id: "free" })).toBe(3);
    expect(
      tierCost(null, "deep", { id: "basic", limits: { deepCost: 4 } }),
    ).toBe(4);
    expect(
      tierCost(normalizeCredits({ costs: { deep: 5 } }), "deep", { id: "pro" }),
    ).toBe(5);
  });
  it("reads a 402 insufficient_credits body (and ignores other errors)", () => {
    const e = new ApiError("x", 402, "insufficient_credits", undefined, {
      code: "insufficient_credits",
      needed: 3,
      balance: 1,
      packs: [
        {
          id: "p5",
          name: "Starter",
          credits: 5,
          prices: { BRL: 990, USD: 299 },
        },
      ],
      upgradeTo: "pro",
    });
    const info = insufficientFrom(e)!;
    expect(info).toMatchObject({ needed: 3, balance: 1, upgradeTo: "pro" });
    expect(info.packs[0]!.credits).toBe(5);
    expect(insufficientFrom(new ApiError("x", 402, "plan_limit"))).toBeNull();
    expect(insufficientFrom(new Error("x"))).toBeNull();
  });
  it("normalizes packs and ledger entries", () => {
    const packs = normalizePacks({
      packs: [
        { id: "b", credits: 15, prices: { USD: 699 } },
        {
          id: "a",
          credits: 5,
          name: "S",
          prices: { BRL: 990, USD: 299 },
          badge: "popular",
        },
        { id: "bad" },
      ],
    });
    expect(packs.map((p) => p.id)).toEqual(["a", "b"]);
    expect(packs[1]!.prices).toEqual({ BRL: 0, USD: 699 });
    const ledger = normalizeLedger({
      entries: [
        {
          id: "1",
          delta: -3,
          reason: "review_deep",
          bucket: "plan",
          createdAt: "2026-10-01T00:00:00Z",
        },
        { id: "2", delta: "x", createdAt: "2026" },
      ],
    });
    expect(ledger).toHaveLength(1);
    expect(reasonLabel(ledger[0]!.reason)).toBe("Deep review");
    expect(reasonLabel("mystery")).toBe("Adjustment");
  });
  it("counts days until a date", () => {
    expect(
      daysUntil("2026-10-03T00:00:00Z", Date.parse("2026-10-01T00:00:00Z")),
    ).toBe(2);
    expect(daysUntil(undefined)).toBeNull();
  });
  it("explains the welcome status kindly, with steps for private profiles", () => {
    expect(welcomeCopy({ status: "granted" })!.title).toBe(
      "You have 1 free review",
    );
    const p = welcomeCopy({ status: "pending", reason: "profile_private" })!;
    expect(p.steps?.length).toBeGreaterThan(1);
    expect(p.refresh).toBe(true);
    expect(
      welcomeCopy({ status: "ineligible", reason: null })!.body,
    ).not.toMatch(/fingerprint|\bip\b|abuse/i);
    expect(
      welcomeCopy({ status: "ineligible", reason: "disabled" }),
    ).toBeNull();
    expect(
      welcomeCopy({ status: "pending", reason: "profile_unavailable" })!
        .refresh,
    ).toBe(true);
  });
  it("reads the API's plan credits and feature names", () => {
    const [p] = normalizePlans({
      plans: [
        {
          id: "pro",
          name: "Pro",
          limits: { monthlyCredits: 40 },
          features: {
            reel: true,
            deepHistory: false,
            cheaperDeep: true,
            monthlyReport: true,
          },
          credits: { monthly: 40, quickCost: 1, deepCost: 2 },
        },
      ],
    });
    expect(p!.limits).toMatchObject({
      monthlyCredits: 40,
      deepCost: 2,
      cheaperDeep: true,
      matchReel: true,
      historyCompare: false,
      monthlyReport: true,
    });
    const body = planUpdateBody(p!);
    expect(body.limits).not.toHaveProperty("deepCost");
    expect(body.features).toMatchObject({
      reel: true,
      deepHistory: false,
      cheaperDeep: true,
    });
    expect(body.features).not.toHaveProperty("matchReel");
  });
});
