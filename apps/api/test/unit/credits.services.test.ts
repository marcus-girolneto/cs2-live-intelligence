import { describe, expect, it } from "vitest";
import { ZonedClock } from "../../src/shared/clock/clock.js";
import {
  addMonths,
  creditPeriod,
} from "../../src/modules/credits/credit-period.js";
import { CreditSettingsService } from "../../src/modules/credits/credit-settings.service.js";
import type { CreditSettingsRepository } from "../../src/modules/credits/credit-settings.repository.js";
import {
  DEFAULT_CREDIT_SETTINGS,
  type Buckets,
  type WelcomeReason,
  type WelcomeStatus,
} from "../../src/modules/credits/credits.dto.js";
import type {
  CreditEntry,
  CreditsRepository,
  Hold,
  WalletView,
} from "../../src/modules/credits/credits.repository.js";
import {
  CreditsService,
  type CreditPlans,
} from "../../src/modules/credits/credits.service.js";
import { WelcomePolicy } from "../../src/modules/credits/welcome.policy.js";
import type { WelcomeRepository } from "../../src/modules/credits/welcome.repository.js";
import { WelcomeService } from "../../src/modules/credits/welcome.service.js";
import { allocate } from "../../src/modules/credits/wallet-sql.js";
import { PlanPolicy } from "../../src/modules/plans/plan.policy.js";
import { silentLogger } from "../../src/shared/logging/logger.js";
import { appError, plan } from "./fakes.js";

const zero = (): Buckets => ({ plan: 0, bonus: 0, purchased: 0 });
/** In-memory wallet + ledger with holds (same rules as the Pg repository). */
class FakeCredits implements CreditsRepository {
  balances = zero();
  holds = new Map<string, Buckets>();
  ledgerRows: CreditEntry[] = [];
  refs = new Set<string>();
  welcome: {
    status: WelcomeStatus | null;
    reason: WelcomeReason | null;
    ip: string | null;
  } = { status: null, reason: null, ip: null };
  private free(): Buckets {
    const held = [...this.holds.values()].reduce(
      (a, h) => ({
        plan: a.plan + h.plan,
        bonus: a.bonus + h.bonus,
        purchased: a.purchased + h.purchased,
      }),
      zero(),
    );
    return {
      plan: this.balances.plan - held.plan,
      bonus: this.balances.bonus - held.bonus,
      purchased: this.balances.purchased - held.purchased,
    };
  }
  async wallet(): Promise<WalletView> {
    return {
      balances: { ...this.balances },
      free: this.free(),
      planExpiresAt: null,
      welcomeStatus: this.welcome.status,
      welcomeReason: this.welcome.reason,
      welcomeIpHash: this.welcome.ip,
    };
  }
  async reserve(_o: string, amount: number): Promise<Hold | undefined> {
    const buckets = allocate(this.free(), amount);
    if (!buckets) return undefined;
    const id = `h${this.holds.size + 1}-${Math.random()}`;
    this.holds.set(id, buckets);
    return { id, buckets };
  }
  async commit(
    _o: string,
    hold: Hold & { amount: number },
    reason: string,
    ref: string,
  ) {
    const b = this.holds.get(hold.id);
    if (!b) return undefined;
    this.holds.delete(hold.id);
    for (const k of ["plan", "bonus", "purchased"] as const) {
      this.balances[k] -= b[k];
      if (b[k]) this.refs.add(`${reason}|${ref}:${k}`);
    }
    return b;
  }
  async release(_o: string, id: string) {
    this.holds.delete(id);
  }
  async credit(entry: CreditEntry) {
    const key = `${entry.reason}|${entry.ref}`;
    if (entry.ref && this.refs.has(key)) return "duplicate" as const;
    if (entry.delta < 0 && this.free()[entry.bucket] < -entry.delta)
      return "insufficient" as const;
    if (entry.ref) this.refs.add(key);
    this.ledgerRows.push(entry);
    if (entry.reason === "plan_grant") this.balances.plan = entry.delta;
    else this.balances[entry.bucket] += entry.delta;
    return "ok" as const;
  }
  async ledger() {
    return [];
  }
  async ledgerTotals() {
    return { ...this.balances };
  }
  async setWelcome(
    _o: string,
    status: WelcomeStatus,
    reason: WelcomeReason | null,
    ip?: string,
  ) {
    if (this.welcome.status === "granted") return;
    this.welcome = { status, reason, ip: ip ?? this.welcome.ip };
  }
}
const settingsRepo = (): CreditSettingsRepository => ({
  settings: async () => ({ ...DEFAULT_CREDIT_SETTINGS }),
  saveSettings: async () => undefined,
  packs: async () => [
    {
      id: "starter",
      name: "Starter",
      credits: 10,
      prices: { BRL: 990 },
      stripePrices: {},
      badge: null,
      active: true,
      sort: 0,
    },
  ],
  savePacks: async () => undefined,
});
const audit = { record: async () => undefined };
const clock = new ZonedClock("America/Sao_Paulo", () =>
  Date.parse("2026-10-19T15:00:00Z"),
);
function plans(
  planId = "free",
  admin = false,
  sub?: Parameters<CreditPlans["entitled"]>[0],
): CreditPlans {
  const record = plan(planId, 0, {
    monthlyCredits: planId === "basic" ? 15 : 0,
  });
  return {
    effective: async () =>
      admin ? PlanPolicy.admin() : PlanPolicy.effective(record),
    plan: async () => record,
    subscription: async () => sub,
    entitled: (s): s is NonNullable<typeof s> => !!s,
    upgradeFor: async () => "basic",
    userExists: async () => true,
  };
}

describe("CreditsService", () => {
  it("reserves → commits once per review, spends plan before bonus before purchased", async () => {
    const repo = new FakeCredits();
    repo.balances = { plan: 1, bonus: 1, purchased: 5 };
    const service = new CreditsService(
      repo,
      new CreditSettingsService(settingsRepo(), audit),
      plans(),
      clock,
      audit,
    );
    const hold = await service.reserve("o", "deep");
    expect(hold.cost).toBe(3);
    expect(await hold.commit("rev-1")).toBe(3);
    expect(await hold.commit("rev-1")).toBe(0);
    expect(repo.balances).toEqual({ plan: 0, bonus: 0, purchased: 4 });
    expect([...repo.refs].sort()).toEqual([
      "review_deep|rev-1:bonus",
      "review_deep|rev-1:plan",
      "review_deep|rev-1:purchased",
    ]);
  });
  it("402 insufficient_credits with needed, free balance, packs and upgrade; release frees the hold", async () => {
    const repo = new FakeCredits();
    repo.balances = { plan: 0, bonus: 1, purchased: 0 };
    const service = new CreditsService(
      repo,
      new CreditSettingsService(settingsRepo(), audit),
      plans(),
      clock,
      audit,
    );
    const hold = await service.reserve("o", "quick");
    const err = await appError(service.reserve("o", "quick"));
    expect(err).toMatchObject({
      status: 402,
      body: {
        code: "insufficient_credits",
        tier: "quick",
        needed: 1,
        balance: 0,
        upgradeTo: "basic",
        packs: [{ id: "starter" }],
      },
    });
    await hold.release();
    expect((await service.reserve("o", "quick")).cost).toBe(1);
  });
  it("administrators are never charged", async () => {
    const service = new CreditsService(
      new FakeCredits(),
      new CreditSettingsService(settingsRepo(), audit),
      plans("free", true),
      clock,
      audit,
    );
    const hold = await service.reserve("boss", "deep");
    expect(hold.cost).toBe(0);
    expect(await hold.commit("r")).toBe(0);
  });
  it("syncs plan credits once per plan and period (calendar months for admin grants)", async () => {
    const repo = new FakeCredits();
    const sub = {
      ownerId: "o",
      planId: "basic",
      status: "active" as const,
      source: "admin" as const,
      currentPeriodEnd: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    };
    const service = new CreditsService(
      repo,
      new CreditSettingsService(settingsRepo(), audit),
      plans("basic", false, sub),
      clock,
      audit,
    );
    expect(await service.syncPlanCredits("o")).toBe("granted");
    expect(await service.syncPlanCredits("o")).toBe("skipped");
    expect(repo.ledgerRows[0]).toMatchObject({
      reason: "plan_grant",
      delta: 15,
      ref: "period:basic:2026-10-01T03:00:00.000Z",
      expiresAt: "2026-11-01T03:00:00.000Z",
    });
    const stripeWithoutPeriod = new CreditsService(
      new FakeCredits(),
      new CreditSettingsService(settingsRepo(), audit),
      plans("basic", false, { ...sub, source: "stripe" }),
      clock,
      audit,
    );
    expect(await stripeWithoutPeriod.syncPlanCredits("o")).toBe("skipped");
  });
});

describe("credit periods", () => {
  it("anchors Stripe periods on the period end without day drift; clamps short months", () => {
    expect(addMonths(new Date("2026-01-31T10:00:00Z"), 1).toISOString()).toBe(
      "2026-02-28T10:00:00.000Z",
    );
    const p = creditPeriod(
      new Date("2026-03-15T00:00:00Z"),
      clock,
      "2027-01-31T10:00:00Z",
    );
    expect(p).toEqual({
      start: "2026-02-28T10:00:00.000Z",
      end: "2026-03-31T10:00:00.000Z",
    });
    expect(creditPeriod(new Date("2026-10-19T15:00:00Z"), clock, null)).toEqual(
      { start: "2026-10-01T03:00:00.000Z", end: "2026-11-01T03:00:00.000Z" },
    );
    const tokyo = new ZonedClock("Asia/Tokyo");
    expect(
      creditPeriod(new Date("2026-12-31T20:00:00Z"), tokyo, null).start,
    ).toBe("2026-12-31T15:00:00.000Z");
  });
});

describe("WelcomePolicy", () => {
  const now = new Date("2026-10-19T00:00:00Z");
  const old = "2020-01-01T00:00:00.000Z";
  it("applies the rules in order", () => {
    const s = { minSteamAgeDays: 30 };
    expect(WelcomePolicy.decide(undefined, s, now)).toEqual({
      status: "pending",
      reason: "profile_unavailable",
    });
    expect(
      WelcomePolicy.decide(
        {
          visibility: "public",
          steamMemberSince: old,
          bans: { vacBans: 1, gameBans: 0 },
        },
        s,
        now,
      ),
    ).toEqual({ status: "ineligible", reason: "banned" });
    expect(WelcomePolicy.decide({ visibility: "private" }, s, now)).toEqual({
      status: "pending",
      reason: "profile_private",
    });
    expect(
      WelcomePolicy.decide(
        { visibility: "public", steamMemberSince: "2026-10-01T00:00:00.000Z" },
        s,
        now,
      ),
    ).toEqual({ status: "ineligible", reason: "account_too_new" });
    expect(
      WelcomePolicy.decide(
        { visibility: "public", steamMemberSince: old },
        s,
        now,
      ),
    ).toEqual({ status: "eligible" });
  });
  it("reduces sign-in addresses to /24 and /48 networks", () => {
    expect(WelcomePolicy.networkPrefix("203.0.113.77")).toBe("203.0.113.0/24");
    expect(WelcomePolicy.networkPrefix("::ffff:203.0.113.77")).toBe(
      "203.0.113.0/24",
    );
    expect(WelcomePolicy.networkPrefix("2001:db8:abcd:12::1")).toBe(
      "2001:db8:abcd::/48",
    );
    expect(WelcomePolicy.networkPrefix("2001:db8::1")).toBe("2001:db8:0::/48");
    expect(WelcomePolicy.networkPrefix("nonsense")).toBeUndefined();
    expect(WelcomePolicy.networkPrefix(undefined)).toBeUndefined();
  });
});

describe("WelcomeService", () => {
  const grants = (): WelcomeRepository & { claimedHashes: Set<string> } => {
    const claimedHashes = new Set<string>();
    return {
      claimedHashes,
      claimed: async (h) => claimedHashes.has(h),
      grant: async (r) => {
        if (claimedHashes.has(r.steamIdHash)) return "already_claimed";
        claimedHashes.add(r.steamIdHash);
        return "granted";
      },
    };
  };
  const hasher = { hash: (d: string, v: string) => `${d}#${v}` };
  const old = {
    visibility: "public" as const,
    steamMemberSince: "2015-01-01T00:00:00.000Z",
  };
  it("grants once per Steam id, keeps pending reasons retriable, never for dev accounts", async () => {
    const repo = new FakeCredits();
    const store = grants();
    let profile: typeof old | { visibility: "private" } = {
      visibility: "private",
    };
    const service = new WelcomeService(
      repo,
      store,
      new CreditSettingsService(settingsRepo(), audit),
      hasher,
      { freshProfile: async () => profile },
      clock,
      silentLogger,
    );
    service.signedIn("o", "765", "198.51.100.4");
    await service.drain();
    expect(await service.view("o", true)).toEqual({
      status: "pending",
      reason: "profile_private",
    });
    expect(repo.welcome.ip).toBe("net#198.51.100.0/24");
    profile = old;
    service.profileRefreshed("o", "765", {
      ...old,
      personaName: "x",
      fetchedAt: "",
    } as never);
    await service.drain();
    expect(await service.view("o", true)).toEqual({ status: "granted" });
    const second = new FakeCredits();
    const other = new WelcomeService(
      second,
      store,
      new CreditSettingsService(settingsRepo(), audit),
      hasher,
      { freshProfile: async () => old },
      clock,
      silentLogger,
    );
    expect(await other.evaluate("o2", "765", null, old)).toEqual({
      status: "ineligible",
      reason: "already_claimed",
    });
    expect(await other.view("dev", false)).toEqual({
      status: "ineligible",
      reason: "not_steam",
    });
    expect(await other.view("fresh", true)).toEqual({
      status: "ineligible",
      reason: "already_claimed",
    });
  });
  it("is disabled when welcome credits are 0 and pending without a hashing key", async () => {
    const disabled = settingsRepo();
    disabled.settings = async () => ({
      ...DEFAULT_CREDIT_SETTINGS,
      welcomeCredits: 0,
    });
    const service = new WelcomeService(
      new FakeCredits(),
      grants(),
      new CreditSettingsService(disabled, audit),
      hasher,
      { freshProfile: async () => old },
      clock,
      silentLogger,
    );
    expect(await service.evaluate("o", "1", null, old)).toEqual({
      status: "ineligible",
      reason: "disabled",
    });
    const keyless = new WelcomeService(
      new FakeCredits(),
      grants(),
      new CreditSettingsService(settingsRepo(), audit),
      { hash: () => undefined },
      { freshProfile: async () => old },
      clock,
      silentLogger,
    );
    expect(await keyless.evaluate("o", "1", null, old)).toEqual({
      status: "pending",
      reason: "not_evaluated",
    });
  });
});
