import { describe, expect, it } from "vitest";
import { ApiError } from "@/shared/http";
import {
  DEFAULT_PLANS,
  checkoutErrorText,
  currencyFor,
  formatPrice,
  freeMonths,
  normalizeAccountPlan,
  normalizePlans,
  normalizeUsage,
  planLimitFrom,
  remaining,
  resetsIn,
  upgradeTarget,
} from "./plans";

describe("plans", () => {
  it("normalises the API catalogue and falls back to the published plans", () => {
    expect(normalizePlans(null)).toBe(DEFAULT_PLANS);
    const plans = normalizePlans({
      plans: [
        { id: "free", name: "Free", limits: { aiReviewsPerDay: 1 } },
        {
          id: "pro",
          prices: { BRL: { month: 3990 } },
          limits: { aiReviewsPerDay: null },
          active: false,
        },
        { name: "no id" },
      ],
    });
    expect(plans.map((p) => p.id)).toEqual(["free", "pro"]);
    expect(plans[1]!.prices.BRL).toEqual({ month: 3990, year: 29900 });
    expect(plans[1]!.limits.aiReviewsPerDay).toBeNull();
    expect(plans[1]!.active).toBe(false);
  });
  it("shows BRL in Portuguese and USD in English with 2 months free yearly", () => {
    expect(currencyFor("pt")).toBe("BRL");
    expect(currencyFor("en")).toBe("USD");
    expect(formatPrice(1490, "BRL", "pt-BR").replace(/\s/g, " ")).toBe(
      "R$ 14,90",
    );
    expect(formatPrice(499, "USD", "en-US")).toBe("$4.99");
    for (const p of DEFAULT_PLANS.slice(1)) {
      expect(freeMonths(p.prices.BRL)).toBe(2);
      expect(freeMonths(p.prices.USD)).toBe(2);
    }
  });
  it("reads usage, remaining counts and the reset countdown", () => {
    const u = normalizeUsage({
      day: "2026-10-19",
      resetsAt: "2026-10-20T00:00:00Z",
      aiReviews: { used: 1, limit: 1 },
      uploads: { used: 3, limit: null },
      liveAiMatches: { used: "x" },
    })!;
    expect(remaining(u.aiReviews)).toBe(0);
    expect(remaining(u.uploads)).toBeNull();
    expect(u.liveAiMatches).toBeUndefined();
    expect(resetsIn(u.resetsAt, Date.parse("2026-10-19T18:48:00Z"))).toEqual({
      h: 5,
      m: 12,
    });
    expect(resetsIn(u.resetsAt, Date.parse("2026-10-21T00:00:00Z"))).toBeNull();
    expect(normalizeAccountPlan({ id: "basic" })).toEqual({
      id: "basic",
      name: "Basic",
    });
    expect(normalizeAccountPlan({})).toBeNull();
  });
  it("turns a 402 plan_limit into an upgrade prompt and picks the right plan", () => {
    const e = new ApiError("Daily limit", 402, "plan_limit", undefined, {
      code: "plan_limit",
      feature: "ai_review",
      limit: 1,
      resetsAt: "2026-10-20T00:00:00Z",
      upgradeTo: "basic",
    });
    expect(planLimitFrom(e)).toEqual({
      feature: "ai_review",
      limit: 1,
      resetsAt: "2026-10-20T00:00:00Z",
      upgradeTo: "basic",
    });
    expect(planLimitFrom(new ApiError("x", 500))).toBeNull();
    expect(planLimitFrom(new ApiError("x", 402, "other"))).toBeNull();
    expect(upgradeTarget(DEFAULT_PLANS, "free", "basic")?.id).toBe("basic");
    expect(upgradeTarget(DEFAULT_PLANS, "basic")?.id).toBe("pro");
    expect(
      upgradeTarget(DEFAULT_PLANS, "free", undefined, "clip_export")?.id,
    ).toBe("basic");
    expect(
      checkoutErrorText(new ApiError("x", 503, "billing_disabled")),
    ).toMatch(/Coming soon/);
  });
  it("maps plan_feature / plan_required errors to upgrade topics", () => {
    const e = (code: string, body: Record<string, unknown>) => ({
      status: 402,
      code,
      body: { code, ...body },
    });
    expect(
      planLimitFrom(e("plan_feature", { feature: "reel", upgradeTo: "pro" })),
    ).toMatchObject({
      feature: "match_reel",
      upgradeTo: "pro",
    });
    expect(
      planLimitFrom(e("plan_feature", { feature: "monthlyReport" }))!.feature,
    ).toBe("monthly_report");
    expect(planLimitFrom(e("plan_required", { teaser: {} }))!.feature).toBe(
      "personal_coach",
    );
    expect(planLimitFrom(e("insufficient_credits", {}))).toBeNull();
  });
});
