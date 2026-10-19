import { describe, expect, it } from "vitest";
import { ZonedClock } from "../src/shared/clock/clock.js";
import {
  formEncode,
  signStripePayload,
  verifyStripeSignature,
} from "../src/infrastructure/billing/stripe-payment-gateway.js";
import type {
  CheckoutRequest,
  PaymentGateway,
} from "../src/infrastructure/billing/payment-gateway.js";
import { BillingService } from "../src/modules/billing/billing.service.js";
import type { BillingRepository } from "../src/modules/billing/billing.repository.js";
import type {
  PlanRecord,
  PlansRepository,
  SubscriptionRecord,
} from "../src/modules/plans/plans.repository.js";
import { PlansService } from "../src/modules/plans/plans.service.js";
import type {
  CounterKind,
  LiveReservation,
  UsageRepository,
} from "../src/modules/usage/usage.repository.js";
import { QuotaService } from "../src/modules/usage/usage.service.js";
import {
  AppError,
  BillingDisabledError,
  PlanLimitError,
} from "../src/shared/errors/index.js";

const plan = (
  id: string,
  sort: number,
  limits: PlanRecord["limits"],
  features = { clipExport: id !== "free", perMapLearning: id === "pro" },
): PlanRecord => ({
  id,
  name: id[0]!.toUpperCase() + id.slice(1),
  prices: id === "free" ? {} : { BRL: { month: 1490, year: 14900 } },
  limits,
  features,
  stripePrices: id === "basic" ? { BRL_month: "price_basicbrl" } : {},
  active: true,
  sort,
});
const PLANS = () => [
  plan("free", 0, {
    aiReviewsPerDay: 1,
    liveAiMatchesPerDay: 0,
    uploadsPerDay: 2,
    retentionDaysMax: 30,
  }),
  plan("basic", 1, {
    aiReviewsPerDay: 3,
    liveAiMatchesPerDay: 1,
    uploadsPerDay: 5,
    retentionDaysMax: 90,
  }),
  plan("pro", 2, {
    aiReviewsPerDay: 8,
    liveAiMatchesPerDay: 5,
    uploadsPerDay: 15,
    retentionDaysMax: 365,
  }),
];

/** In-memory PlansRepository. */
class FakePlans implements PlansRepository {
  plans = new Map(PLANS().map((p) => [p.id, p]));
  subs = new Map<string, SubscriptionRecord>();
  roles = new Map<string, "user" | "admin">([
    ["u1", "user"],
    ["u2", "user"],
    ["boss", "admin"],
  ]);
  retention = new Map<string, number>([["u1", 365]]);
  audits: string[] = [];
  async listPlans() {
    return [...this.plans.values()].sort((a, b) => a.sort - b.sort);
  }
  async getPlan(id: string) {
    return this.plans.get(id);
  }
  async savePlan(p: PlanRecord) {
    this.plans.set(p.id, p);
  }
  async role(id: string) {
    return this.roles.get(id);
  }
  async userExists(id: string) {
    return this.roles.has(id);
  }
  async subscription(id: string) {
    return this.subs.get(id);
  }
  async subscriptions(ids: string[]) {
    return ids.flatMap((id) => (this.subs.has(id) ? [this.subs.get(id)!] : []));
  }
  async saveSubscription(s: SubscriptionRecord) {
    this.subs.set(s.ownerId, { ...s });
  }
  async findSubscriptionByStripe(ref: {
    customerId?: string | null;
    subscriptionId?: string | null;
  }) {
    return [...this.subs.values()].find(
      (s) =>
        (ref.subscriptionId && s.stripeSubscriptionId === ref.subscriptionId) ||
        (ref.customerId && s.stripeCustomerId === ref.customerId),
    );
  }
  async retentionDays(id: string) {
    return this.retention.get(id);
  }
  async clampRetention(id: string, max: number) {
    if ((this.retention.get(id) ?? 0) > max) this.retention.set(id, max);
  }
  async audit(_admin: string, action: string) {
    this.audits.push(action);
  }
}
/** In-memory UsageRepository (single-threaded, so trivially atomic). */
class FakeUsage implements UsageRepository {
  counters = new Map<string, number>();
  live = new Map<string, number>();
  async reserve(o: string, d: string, k: CounterKind, limit: number | null) {
    const key = `${o}|${d}|${k}`;
    const n = this.counters.get(key) ?? 0;
    if (limit !== null && n >= limit) return false;
    this.counters.set(key, n + 1);
    return true;
  }
  async release(o: string, d: string, k: CounterKind) {
    const key = `${o}|${d}|${k}`;
    this.counters.set(key, Math.max(0, (this.counters.get(key) ?? 0) - 1));
  }
  async used(o: string, d: string, k: CounterKind) {
    return this.counters.get(`${o}|${d}|${k}`) ?? 0;
  }
  async reserveLive(
    o: string,
    d: string,
    m: string,
    limit: number | null,
    cap: number,
  ): Promise<LiveReservation> {
    const key = `${o}|${d}|${m}`;
    const calls = this.live.get(key);
    if (calls !== undefined) {
      if (calls >= cap) return "match_cap";
      this.live.set(key, calls + 1);
      return "ok";
    }
    if (limit !== null && (await this.liveMatches(o, d)) >= limit)
      return "match_limit";
    this.live.set(key, 1);
    return "ok";
  }
  async releaseLive(o: string, d: string, m: string) {
    const key = `${o}|${d}|${m}`;
    const calls = (this.live.get(key) ?? 1) - 1;
    if (calls <= 0) this.live.delete(key);
    else this.live.set(key, calls);
  }
  async liveMatches(o: string, d: string) {
    return [...this.live.keys()].filter((k) => k.startsWith(`${o}|${d}|`))
      .length;
  }
}

function setup(at = "2026-10-19T15:00:00Z") {
  let now = Date.parse(at);
  const clock = new ZonedClock("America/Sao_Paulo", () => now);
  const plansRepo = new FakePlans();
  const usage = new FakeUsage();
  const plans = new PlansService(plansRepo, clock);
  const quota = new QuotaService(usage, plans, clock, 3);
  return {
    clock,
    plansRepo,
    usage,
    plans,
    quota,
    setNow: (iso: string) => (now = Date.parse(iso)),
  };
}
async function limitError(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(PlanLimitError);
  return (error as AppError).body();
}

describe("ZonedClock", () => {
  it("uses the local calendar day and the next local midnight", () => {
    const sp = new ZonedClock("America/Sao_Paulo", () =>
      Date.parse("2026-10-19T02:59:00Z"),
    );
    expect(sp.day()).toBe("2026-10-18");
    expect(sp.nextMidnight()).toBe("2026-10-19T03:00:00.000Z");
    expect(sp.day(new Date("2026-10-19T03:00:00Z"))).toBe("2026-10-19");
    const ny = new ZonedClock("America/New_York");
    // DST starts 2026-03-08 02:00 local: midnights on either side have different offsets.
    expect(ny.nextMidnight(new Date("2026-03-07T12:00:00Z"))).toBe(
      "2026-03-08T05:00:00.000Z",
    );
    expect(ny.nextMidnight(new Date("2026-03-08T12:00:00Z"))).toBe(
      "2026-03-09T04:00:00.000Z",
    );
    expect(new ZonedClock("Not/AZone").timeZone).toBe("America/Sao_Paulo");
    expect(new ZonedClock().timeZone).toBe("America/Sao_Paulo");
  });
});

describe("QuotaService (in-memory fakes)", () => {
  it("consumes daily reviews, returns the 402 body and refunds failures", async () => {
    const { quota } = setup();
    const first = await quota.reserveReview("u1");
    expect(await limitError(quota.reserveReview("u1"))).toEqual({
      error: expect.any(String),
      code: "plan_limit",
      feature: "ai_review",
      limit: 1,
      resetsAt: "2026-10-20T03:00:00.000Z",
      upgradeTo: "basic",
    });
    await first.release(); // failed provider call: not counted
    await quota.reserveReview("u1");
    expect((await quota.usageView("u1")).aiReviews).toEqual({
      used: 1,
      limit: 1,
    });
  });
  it("resets at midnight in the app time zone", async () => {
    const { quota, setNow } = setup("2026-10-19T02:58:00Z");
    await quota.reserveUpload("u1");
    await quota.reserveUpload("u1");
    await limitError(quota.reserveUpload("u1"));
    setNow("2026-10-19T02:59:59Z"); // still 23:59 in São Paulo
    await limitError(quota.reserveUpload("u1"));
    setNow("2026-10-19T03:00:00Z");
    await quota.reserveUpload("u1");
    expect((await quota.usageView("u1")).day).toBe("2026-10-19");
  });
  it("counts live AI matches, caps calls per match and refunds a failed first call", async () => {
    const { quota, plansRepo } = setup();
    const body = await limitError(quota.reserveLiveCall("u1", "session:a"));
    expect(body).toMatchObject({
      feature: "live_ai",
      limit: 0,
      upgradeTo: "basic",
    });
    plansRepo.subs.set("u1", {
      ownerId: "u1",
      planId: "basic",
      status: "active",
      source: "admin",
      currentPeriodEnd: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    });
    const failed = await quota.reserveLiveCall("u1", "session:a");
    await failed.release();
    expect((await quota.usageView("u1")).liveAiMatches.used).toBe(0);
    for (let i = 0; i < 3; i++) await quota.reserveLiveCall("u1", "session:a");
    expect(
      await limitError(quota.reserveLiveCall("u1", "session:a")),
    ).toMatchObject({ feature: "live_ai" }); // per-match cap (3 in this test)
    expect(
      await limitError(quota.reserveLiveCall("u1", "session:b")),
    ).toMatchObject({ limit: 1, upgradeTo: "pro" });
  });
  it("never limits administrators", async () => {
    const { quota } = setup();
    for (let i = 0; i < 20; i++) {
      await quota.reserveReview("boss");
      await quota.reserveUpload("boss");
      await quota.reserveLiveCall("boss", `m${i}`);
    }
    expect(await quota.usageView("boss")).toMatchObject({
      aiReviews: { used: 0, limit: null },
      uploads: { limit: null },
    });
  });
});

describe("PlansService (in-memory fakes)", () => {
  it("resolves entitlement, grants and clamps retention", async () => {
    const { plans, plansRepo, setNow } = setup();
    expect(await plans.accountPlan("u1")).toMatchObject({
      id: "free",
      source: "default",
      status: "active",
    });
    expect(await plans.clampRetention("u1", 365)).toBe(30);
    await plans.grant("boss", "u1", {
      planId: "pro",
      until: "2026-11-01T00:00:00Z",
    });
    expect(await plans.accountPlan("u1")).toMatchObject({
      id: "pro",
      source: "admin",
      renewsAt: "2026-11-01T00:00:00.000Z",
    });
    expect((await plans.effective("u1")).features.perMapLearning).toBe(true);
    await plans.grant("boss", "u1", { planId: "basic" });
    expect(plansRepo.retention.get("u1")).toBe(90);
    await expect(
      plans.grant("boss", "u1", {
        planId: "pro",
        until: "2020-01-01T00:00:00Z",
      }),
    ).rejects.toThrow(/future/);
    await expect(
      plans.grant("boss", "nobody", { planId: "pro" }),
    ).rejects.toThrow(/User/);
    await plans.grant("boss", "u1", {
      planId: "pro",
      until: "2026-10-20T00:00:00Z",
    });
    setNow("2026-10-21T00:00:00Z"); // grant expired
    expect((await plans.effective("u1")).id).toBe("free");
    expect(plansRepo.audits).toContain("user.plan");
    await expect(
      plans.updatePlan("boss", "free", { active: false }),
    ).rejects.toThrow(/free plan/);
    const updated = await plans.updatePlan("boss", "basic", {
      limits: { aiReviewsPerDay: 4 },
      active: false,
    });
    expect(updated.limits).toMatchObject({
      aiReviewsPerDay: 4,
      uploadsPerDay: 5,
    });
    expect((await plans.publicPlans()).map((p) => p.id)).toEqual([
      "free",
      "pro",
    ]);
  });
});

describe("Stripe webhook signature and form encoding", () => {
  const secret = "whsec_unit";
  const body = '{"id":"evt_1"}';
  it("accepts valid signatures and rejects tampering, staleness and malformed headers", () => {
    const now = 1_800_000_000;
    const header = signStripePayload(body, secret, now);
    expect(() =>
      verifyStripeSignature(body, header, secret, now),
    ).not.toThrow();
    expect(() =>
      verifyStripeSignature(
        body,
        `${header},v1=${"0".repeat(64)}`,
        secret,
        now,
      ),
    ).not.toThrow();
    expect(() =>
      verifyStripeSignature(body + " ", header, secret, now),
    ).toThrow(/Invalid/);
    expect(() =>
      verifyStripeSignature(body, header, "whsec_other", now),
    ).toThrow(/Invalid/);
    expect(() =>
      verifyStripeSignature(body, header, secret, now + 301),
    ).toThrow(/tolerance/);
    expect(() => verifyStripeSignature(body, "garbage", secret, now)).toThrow(
      /Malformed/,
    );
    expect(() => verifyStripeSignature(body, undefined, secret, now)).toThrow(
      /Missing/,
    );
  });
  it("encodes nested params the way Stripe expects", () => {
    expect(
      decodeURIComponent(
        formEncode({
          line_items: [{ price: "price_1", quantity: 1 }],
          payment_method_types: ["card", "pix"],
          metadata: { ownerId: "u1" },
          skip: undefined,
        }).toString(),
      ),
    ).toBe(
      "line_items[0][price]=price_1&line_items[0][quantity]=1&payment_method_types[0]=card&payment_method_types[1]=pix&metadata[ownerId]=u1",
    );
  });
});

describe("BillingService (in-memory fakes)", () => {
  class FakeGateway implements PaymentGateway {
    readonly name = "fake";
    checkouts: CheckoutRequest[] = [];
    async createCheckout(r: CheckoutRequest) {
      this.checkouts.push(r);
      return { url: "https://pay.example/c" };
    }
    async createPortal(customer: string) {
      return { url: `https://pay.example/p/${customer}` };
    }
    verifyWebhook(raw: string) {
      return JSON.parse(raw) as {
        id: string;
        type: string;
        object: Record<string, unknown>;
      };
    }
  }
  class FakeEvents implements BillingRepository {
    ids = new Set<string>();
    async seen(id: string) {
      return this.ids.has(id);
    }
    async record(id: string) {
      if (this.ids.has(id)) return false;
      this.ids.add(id);
      return true;
    }
  }
  const config = {
    webOrigin: "https://app.example",
    paymentMethods: { BRL: ["card", "pix"], USD: ["card"] },
    env: { STRIPE_PRICE_PRO_YEARLY: "price_proyear" },
  };
  it("is disabled without a gateway", async () => {
    const { plans } = setup();
    const billing = new BillingService(
      undefined,
      plans,
      new FakeEvents(),
      config,
    );
    expect(billing.status()).toEqual({ enabled: false });
    await expect(
      billing.checkout("u1", {
        planId: "basic",
        interval: "month",
        currency: "BRL",
      }),
    ).rejects.toBeInstanceOf(BillingDisabledError);
    await expect(billing.webhook("{}", "x")).rejects.toBeInstanceOf(
      BillingDisabledError,
    );
  });
  it("creates checkouts and applies subscription lifecycle events idempotently", async () => {
    const { plans, plansRepo } = setup();
    const gateway = new FakeGateway();
    const billing = new BillingService(
      gateway,
      plans,
      new FakeEvents(),
      config,
    );
    await billing.checkout("u1", {
      planId: "basic",
      interval: "month",
      currency: "BRL",
    });
    await billing.checkout("u1", {
      planId: "pro",
      interval: "year",
      currency: "USD",
    });
    expect(
      gateway.checkouts.map((c) => [c.priceId, c.paymentMethodTypes]),
    ).toEqual([
      ["price_basicbrl", ["card", "pix"]],
      ["price_proyear", ["card"]],
    ]);
    expect(gateway.checkouts[0]!.successUrl).toBe(
      "https://app.example/billing?status=success",
    );
    await expect(
      billing.checkout("u1", {
        planId: "pro",
        interval: "month",
        currency: "BRL",
      }),
    ).rejects.toThrow(/no price/);
    await expect(
      billing.checkout("u1", {
        planId: "free",
        interval: "month",
        currency: "BRL",
      }),
    ).rejects.toThrow(/not available/);
    await expect(billing.portal("u1")).rejects.toThrow(/No billing account/);

    const send = (id: string, type: string, object: Record<string, unknown>) =>
      billing.webhook(JSON.stringify({ id, type, object }), "sig");
    await send("evt_1", "checkout.session.completed", {
      mode: "subscription",
      client_reference_id: "u1",
      customer: "cus_1",
      subscription: "sub_1",
      metadata: { planId: "basic" },
    });
    expect(await plans.accountPlan("u1")).toMatchObject({
      id: "basic",
      source: "stripe",
    });
    expect(await send("evt_1", "checkout.session.completed", {})).toEqual({
      received: true,
      duplicate: true,
    });
    await send("evt_2", "customer.subscription.updated", {
      id: "sub_1",
      customer: "cus_1",
      status: "active",
      items: {
        data: [
          { price: { id: "price_proyear" }, current_period_end: 1_900_000_000 },
        ],
      },
    });
    expect(await plans.accountPlan("u1")).toMatchObject({
      id: "pro",
      renewsAt: new Date(1_900_000_000_000).toISOString(),
    });
    await send("evt_3", "invoice.payment_failed", { subscription: "sub_1" });
    expect(plansRepo.subs.get("u1")!.status).toBe("past_due");
    expect((await plans.effective("u1")).id).toBe("pro"); // grace while retrying
    expect(await billing.portal("u1")).toEqual({
      url: "https://pay.example/p/cus_1",
    });
    await send("evt_4", "customer.subscription.deleted", {
      id: "sub_1",
      customer: "cus_1",
      status: "canceled",
    });
    expect((await plans.effective("u1")).id).toBe("free");
    expect(plansRepo.retention.get("u1")).toBe(30);
  });
});
