import { describe, expect, it } from "vitest";
import { PlanPolicy } from "../../src/modules/plans/plan.policy.js";
import { PlansService } from "../../src/modules/plans/plans.service.js";
import type { SubscriptionRecord } from "../../src/modules/plans/plans.repository.js";
import { ZonedClock } from "../../src/shared/clock/clock.js";
import { appError, FakePlansRepository, plan } from "./fakes.js";

const NOW = new Date("2026-10-19T12:00:00Z");
const sub = (over: Partial<SubscriptionRecord> = {}): SubscriptionRecord => ({
  ownerId: "u1",
  planId: "pro",
  status: "active",
  source: "admin",
  currentPeriodEnd: null,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  ...over,
});

describe("PlanPolicy", () => {
  it("entitles active/trialing/past_due subscriptions until their period ends", () => {
    expect(PlanPolicy.entitled(undefined, NOW)).toBe(false);
    for (const status of ["active", "trialing", "past_due"] as const)
      expect(PlanPolicy.entitled(sub({ status }), NOW)).toBe(true);
    expect(PlanPolicy.entitled(sub({ status: "canceled" }), NOW)).toBe(false);
    expect(
      PlanPolicy.entitled(
        sub({ currentPeriodEnd: "2026-10-19T11:59:59Z" }),
        NOW,
      ),
    ).toBe(false);
    expect(
      PlanPolicy.entitled(
        sub({ currentPeriodEnd: "2026-10-20T00:00:00Z" }),
        NOW,
      ),
    ).toBe(true);
  });
  it("falls back to the free plan (or the built-in fallback) when not entitled", () => {
    const plans = new Map([
      ["free", plan("free", 0)],
      ["pro", plan("pro", 1)],
    ]);
    const lookup = (id: string) => plans.get(id);
    expect(PlanPolicy.applicable(sub(), lookup, NOW).id).toBe("pro");
    expect(
      PlanPolicy.applicable(sub({ status: "canceled" }), lookup, NOW).id,
    ).toBe("free");
    expect(PlanPolicy.applicable(sub({ planId: "gone" }), lookup, NOW).id).toBe(
      "free",
    );
    expect(
      PlanPolicy.applicable(undefined, () => undefined, NOW).limits
        .uploadsPerDay,
    ).toBe(2);
  });
  it("clamps retention to the plan maximum; unlimited keeps the request", () => {
    const effective = PlanPolicy.effective(
      plan("free", 0, { retentionDaysMax: 30 }),
    );
    expect(PlanPolicy.clampRetention(effective, 90)).toBe(30);
    expect(PlanPolicy.clampRetention(effective, 7)).toBe(7);
    expect(PlanPolicy.clampRetention(PlanPolicy.admin(), 365)).toBe(365);
  });
  it("admins are unlimited with every feature", () => {
    const admin = PlanPolicy.admin();
    expect(admin.admin).toBe(true);
    const { monthlyCredits, ...quotas } = admin.limits;
    expect(Object.values(quotas).every((v) => v === null)).toBe(true);
    expect(monthlyCredits).toBe(0);
    expect(Object.values(admin.features).every((v) => v === true)).toBe(true);
  });
  it("upgrades to the next active plan with a higher or unlimited quota", () => {
    const plans = [
      plan("free", 0, { aiReviewsPerDay: 1 }),
      plan("basic", 1, { aiReviewsPerDay: 1 }),
      plan("hidden", 2, { aiReviewsPerDay: 50 }, false),
      plan("pro", 3, { aiReviewsPerDay: 5 }),
      plan("max", 4, { aiReviewsPerDay: null }),
    ];
    expect(PlanPolicy.upgradeFor(plans, "free", "aiReviewsPerDay", 1)).toBe(
      "pro",
    );
    expect(PlanPolicy.upgradeFor(plans, "pro", "aiReviewsPerDay", 5)).toBe(
      "max",
    );
    expect(
      PlanPolicy.upgradeFor(plans, "max", "aiReviewsPerDay", 100),
    ).toBeNull();
  });
});

describe("PlansService", () => {
  const setup = () => {
    const repo = new FakePlansRepository();
    const service = new PlansService(
      repo,
      new ZonedClock("UTC", () => NOW.getTime()),
    );
    return { repo, service };
  };
  it("grants a plan, clamps retention to the new maximum and audits", async () => {
    const { repo, service } = setup();
    const view = await service.grant("boss", "u1", { planId: "free" });
    expect(view).toMatchObject({
      id: "free",
      source: "admin",
      status: "active",
    });
    expect(repo.retention.get("u1")).toBe(30);
    expect(repo.audits.map((a) => a.action)).toEqual(["user.plan"]);
  });
  it("rejects unknown users/plans and past end dates", async () => {
    const { repo, service } = setup();
    expect(
      (await appError(service.grant("boss", "nobody", { planId: "pro" })))
        .status,
    ).toBe(404);
    expect(
      (await appError(service.grant("boss", "u1", { planId: "nope" }))).body,
    ).toMatchObject({
      error: "Plan not found",
      code: "not_found",
    });
    const past = await appError(
      service.grant("boss", "u1", {
        planId: "pro",
        until: "2026-10-18T00:00:00Z",
      }),
    );
    expect(past).toMatchObject({
      status: 400,
      body: { error: "until must be in the future" },
    });
    expect(repo.subs.size).toBe(0);
    expect(repo.audits).toEqual([]);
  });
  it("applies provider state with unknown plans falling back to free", async () => {
    const { repo, service } = setup();
    await service.applyProviderState({
      ...sub({ planId: "ghost", source: "stripe" }),
    });
    expect(repo.subs.get("u1")?.planId).toBe("free");
    expect(repo.retention.get("u1")).toBe(30);
  });
  it("updates plans but never deactivates the free plan", async () => {
    const { repo, service } = setup();
    const err = await appError(
      service.updatePlan("boss", "free", { active: false }),
    );
    expect(err).toMatchObject({
      status: 400,
      body: { code: "invalid_request" },
    });
    const updated = await service.updatePlan("boss", "pro", {
      limits: { uploadsPerDay: 9 },
    });
    expect(updated.limits).toMatchObject({
      uploadsPerDay: 9,
      aiReviewsPerDay: 10,
    });
    expect(repo.audits[0]?.action).toBe("plan.update");
  });
  it("admins see the role plan; perMapLearning follows the plan", async () => {
    const { repo, service } = setup();
    expect(await service.accountPlan("boss")).toMatchObject({
      id: "admin",
      source: "role",
    });
    expect(await service.perMapLearning("u1")).toBe(false);
    repo.subs.set("u1", sub());
    expect(await service.perMapLearning("u1")).toBe(true);
    expect(await service.clampRetention("u1", 400)).toBe(365);
  });
});
