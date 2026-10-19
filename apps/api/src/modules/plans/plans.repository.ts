import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";
import type {
  PlanFeatures,
  PlanLimits,
  Prices,
  SubscriptionSource,
  SubscriptionStatus,
} from "./plans.dto.js";

export type PlanRecord = {
  id: string;
  name: string;
  prices: Prices;
  limits: PlanLimits;
  features: PlanFeatures;
  stripePrices: Record<string, string>;
  active: boolean;
  sort: number;
};
export type SubscriptionRecord = {
  ownerId: string;
  planId: string;
  status: SubscriptionStatus;
  source: SubscriptionSource;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  updatedAt?: string;
};

export interface PlansRepository {
  listPlans(): Promise<PlanRecord[]>;
  getPlan(id: string): Promise<PlanRecord | undefined>;
  savePlan(plan: PlanRecord): Promise<void>;
  role(ownerId: string): Promise<"user" | "admin" | undefined>;
  userExists(ownerId: string): Promise<boolean>;
  subscription(ownerId: string): Promise<SubscriptionRecord | undefined>;
  subscriptions(ownerIds: string[]): Promise<SubscriptionRecord[]>;
  saveSubscription(sub: SubscriptionRecord): Promise<void>;
  findSubscriptionByStripe(ref: {
    customerId?: string | null;
    subscriptionId?: string | null;
  }): Promise<SubscriptionRecord | undefined>;
  retentionDays(ownerId: string): Promise<number | undefined>;
  /** Lowers the account's retention setting to `max` when it is above it. */
  clampRetention(ownerId: string, max: number): Promise<void>;
  audit(adminId: string, action: string, details: unknown): Promise<void>;
}

const LIMIT_KEYS = [
  "aiReviewsPerDay",
  "liveAiMatchesPerDay",
  "uploadsPerDay",
  "retentionDaysMax",
] as const;
const quota = (v: unknown): number | null =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null;
/** Stored limits jsonb holds both quotas and feature flags. */
export function splitLimits(raw: unknown): {
  limits: PlanLimits;
  features: PlanFeatures;
} {
  const v = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    limits: Object.fromEntries(
      LIMIT_KEYS.map((k) => [k, quota(v[k])]),
    ) as PlanLimits,
    features: {
      clipExport: v.clipExport === true,
      perMapLearning: v.perMapLearning === true,
    },
  };
}
const iso = (v: unknown): string | null =>
  v ? new Date(v as string).toISOString() : null;

export class PgPlansRepository implements PlansRepository {
  constructor(private readonly db: Db) {}
  private plan(row: Record<string, unknown>): PlanRecord {
    return {
      id: row.id as string,
      name: row.name as string,
      prices: (row.prices ?? {}) as Prices,
      ...splitLimits(row.limits),
      stripePrices: (row.stripe_prices ?? {}) as Record<string, string>,
      active: row.active as boolean,
      sort: Number(row.sort),
    };
  }
  private sub(row: Record<string, unknown>): SubscriptionRecord {
    return {
      ownerId: row.owner_id as string,
      planId: row.plan_id as string,
      status: row.status as SubscriptionStatus,
      source: row.source as SubscriptionSource,
      currentPeriodEnd: iso(row.current_period_end),
      stripeCustomerId: (row.stripe_customer_id as string | null) ?? null,
      stripeSubscriptionId:
        (row.stripe_subscription_id as string | null) ?? null,
      updatedAt: iso(row.updated_at) ?? undefined,
    };
  }
  async listPlans(): Promise<PlanRecord[]> {
    const r = await this.db.execute(
      sql`select id,name,prices,limits,stripe_prices,active,sort from plans order by sort,id`,
    );
    return r.rows.map((row) => this.plan(row));
  }
  async getPlan(id: string): Promise<PlanRecord | undefined> {
    const r = await this.db.execute(
      sql`select id,name,prices,limits,stripe_prices,active,sort from plans where id=${id}`,
    );
    return r.rows[0] ? this.plan(r.rows[0]) : undefined;
  }
  async savePlan(plan: PlanRecord): Promise<void> {
    const limits = { ...plan.limits, ...plan.features };
    await this.db.execute(
      sql`insert into plans(id,name,prices,limits,stripe_prices,active,sort) values(${plan.id},${plan.name},${JSON.stringify(plan.prices)}::jsonb,${JSON.stringify(limits)}::jsonb,${JSON.stringify(plan.stripePrices)}::jsonb,${plan.active},${plan.sort})
        on conflict(id) do update set name=excluded.name,prices=excluded.prices,limits=excluded.limits,stripe_prices=excluded.stripe_prices,active=excluded.active,sort=excluded.sort,updated_at=now()`,
    );
  }
  async role(ownerId: string): Promise<"user" | "admin" | undefined> {
    const r = await this.db.execute(
      sql`select role from users where id=${ownerId}`,
    );
    const role = r.rows[0]?.role;
    return role === "admin" ? "admin" : role === "user" ? "user" : undefined;
  }
  async userExists(ownerId: string): Promise<boolean> {
    const r = await this.db.execute(
      sql`select 1 from users where id=${ownerId}`,
    );
    return r.rows.length > 0;
  }
  async subscription(ownerId: string): Promise<SubscriptionRecord | undefined> {
    const r = await this.db.execute(
      sql`select * from subscriptions where owner_id=${ownerId}`,
    );
    return r.rows[0] ? this.sub(r.rows[0]) : undefined;
  }
  async subscriptions(ownerIds: string[]): Promise<SubscriptionRecord[]> {
    if (!ownerIds.length) return [];
    const r = await this.db.execute(
      sql`select * from subscriptions where owner_id in (select jsonb_array_elements_text(${JSON.stringify(ownerIds)}::jsonb))`,
    );
    return r.rows.map((row) => this.sub(row));
  }
  async saveSubscription(s: SubscriptionRecord): Promise<void> {
    await this.db.execute(
      sql`insert into subscriptions(owner_id,plan_id,status,source,current_period_end,stripe_customer_id,stripe_subscription_id) values(${s.ownerId},${s.planId},${s.status},${s.source},${s.currentPeriodEnd}::timestamptz,${s.stripeCustomerId},${s.stripeSubscriptionId})
        on conflict(owner_id) do update set plan_id=excluded.plan_id,status=excluded.status,source=excluded.source,current_period_end=excluded.current_period_end,stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,updated_at=now()`,
    );
  }
  async findSubscriptionByStripe(ref: {
    customerId?: string | null;
    subscriptionId?: string | null;
  }): Promise<SubscriptionRecord | undefined> {
    if (ref.subscriptionId) {
      const r = await this.db.execute(
        sql`select * from subscriptions where stripe_subscription_id=${ref.subscriptionId} limit 1`,
      );
      if (r.rows[0]) return this.sub(r.rows[0]);
    }
    if (ref.customerId) {
      const r = await this.db.execute(
        sql`select * from subscriptions where stripe_customer_id=${ref.customerId} order by updated_at desc limit 1`,
      );
      if (r.rows[0]) return this.sub(r.rows[0]);
    }
    return undefined;
  }
  async retentionDays(ownerId: string): Promise<number | undefined> {
    const r = await this.db.execute(
      sql`select retention_days from users where id=${ownerId}`,
    );
    return r.rows[0] ? Number(r.rows[0].retention_days) : undefined;
  }
  async clampRetention(ownerId: string, max: number): Promise<void> {
    await this.db.execute(
      sql`update users set retention_days=${max} where id=${ownerId} and retention_days>${max}`,
    );
  }
  async audit(
    adminId: string,
    action: string,
    details: unknown,
  ): Promise<void> {
    await this.db.execute(
      sql`insert into admin_audit(id,admin_id,action,details) values(${randomUUID()},${adminId},${action},${JSON.stringify(details ?? {})}::jsonb)`,
    );
  }
}
