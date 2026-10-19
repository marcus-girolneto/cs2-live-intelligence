import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_PLANS } from "./catalogue";

/**
 * The built-in catalogue is only a fallback for when GET plans is unreachable, but it must
 * never advertise anything the backend doesn't sell: compare it with the API's seed migrations.
 */
const MIGRATIONS = resolve(__dirname, "../../../../../api/migrations");
const sql = (file: string) => readFileSync(resolve(MIGRATIONS, file), "utf8");

function backendDefaults() {
  const prices = new Map<string, unknown>();
  for (const m of sql("0006_plans_billing.sql").matchAll(
    /\('(\w+)', '\w+', '(\{[^']*\})'::jsonb/g,
  ))
    prices.set(m[1]!, JSON.parse(m[2]!));
  const limits = new Map<string, Record<string, unknown>>();
  for (const m of sql("0007_credits_tiers_reports.sql").matchAll(
    /UPDATE plans SET limits = '(\{[^']*\})'::jsonb.*?WHERE id = '(\w+)'/g,
  ))
    limits.set(m[2]!, JSON.parse(m[1]!));
  // 0008: Personal Coach is a Pro feature.
  expect(sql("0008_personal_coach.sql")).toMatch(/'personalCoach', id = 'pro'/);
  for (const [id, l] of limits) l.personalCoach = id === "pro";
  return { prices, limits };
}

describe("DEFAULT_PLANS mirrors the backend defaults", () => {
  const { prices, limits } = backendDefaults();
  it("has the same plans", () => {
    expect(DEFAULT_PLANS.map((p) => p.id).sort()).toEqual(
      [...limits.keys()].sort(),
    );
  });
  for (const plan of DEFAULT_PLANS) {
    it(`${plan.id}: limits, features and prices match`, () => {
      const l = limits.get(plan.id)!;
      expect({
        aiReviewsPerDay: plan.limits.aiReviewsPerDay,
        liveAiMatchesPerDay: plan.limits.liveAiMatchesPerDay,
        uploadsPerDay: plan.limits.uploadsPerDay,
        retentionDaysMax: plan.limits.retentionDays,
        monthlyCredits: plan.limits.monthlyCredits,
        clipExport: plan.limits.clipExport,
        perMapLearning: plan.limits.perMapLearning,
        cheaperDeep: plan.limits.cheaperDeep,
        monthlyReport: plan.limits.monthlyReport,
        reel: plan.limits.matchReel,
        deepHistory: plan.limits.historyCompare,
        priorityQueue: plan.limits.priorityQueue,
        personalCoach: plan.limits.personalCoach,
      }).toEqual(l);
      // Deep costs 3 credits, 2 with the cheaper-Deep perk.
      expect(plan.limits.deepCost).toBe(l.cheaperDeep ? 2 : 3);
      const p = prices.get(plan.id) as
        Record<string, { month: number; year: number }> | undefined;
      if (p && Object.keys(p).length) expect(plan.prices).toEqual(p);
      else expect(plan.prices.USD.month).toBe(0);
    });
  }
});
