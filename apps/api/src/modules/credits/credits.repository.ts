import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";
import { isoDate, isoOrNull } from "../../shared/db/rows.js";
import {
  BUCKETS,
  type Bucket,
  type Buckets,
  type CreditReason,
  type LedgerEntryDto,
  type WelcomeReason,
  type WelcomeStatus,
} from "./credits.dto.js";
import {
  addToBucket,
  allocate,
  appendLedger,
  available,
  lockWallet,
  replacePlanCredits,
  zero,
} from "./wallet-sql.js";

export type WalletView = {
  balances: Buckets;
  /** Free = balance minus unexpired holds (what a new reservation can use). */
  free: Buckets;
  planExpiresAt: string | null;
  welcomeStatus: WelcomeStatus | null;
  welcomeReason: WelcomeReason | null;
  welcomeIpHash: string | null;
};
export type Hold = { id: string; buckets: Buckets };
/** A credit movement other than a review spend. */
export type CreditEntry = {
  ownerId: string;
  delta: number;
  reason: Exclude<CreditReason, "review_quick" | "review_deep" | "expire">;
  bucket: Bucket;
  ref?: string;
  note?: string;
  adminId?: string;
  /** plan_grant: when these plan credits expire (period end). */
  expiresAt?: string | null;
};
export type CreditResult = "ok" | "duplicate" | "insufficient";

/** Wallet, holds and the append-only ledger. Every write locks the wallet row first. */
export interface CreditsRepository {
  wallet(ownerId: string, now: Date): Promise<WalletView>;
  /** Reserves `amount` (spend order plan → bonus → purchased); undefined when it does not fit. */
  reserve(
    ownerId: string,
    amount: number,
    reason: string,
    now: Date,
    ttlMs: number,
  ): Promise<Hold | undefined>;
  /**
   * Turns a hold into ledger spends (ref "<ref>:<bucket>"); returns what was charged. A hold
   * that expired meanwhile is charged from the free balance when `amount` still fits.
   */
  commit(
    ownerId: string,
    hold: Hold & { amount: number },
    reason: "review_quick" | "review_deep",
    ref: string,
    now: Date,
  ): Promise<Buckets | undefined>;
  release(ownerId: string, holdId: string): Promise<void>;
  credit(entry: CreditEntry, now: Date): Promise<CreditResult>;
  ledger(ownerId: string, limit: number): Promise<LedgerEntryDto[]>;
  /** Sum of the ledger per bucket (reconciliation against the wallet). */
  ledgerTotals(ownerId: string): Promise<Buckets>;
  setWelcome(
    ownerId: string,
    status: WelcomeStatus,
    reason: WelcomeReason | null,
    ipHash?: string,
  ): Promise<void>;
}

export class PgCreditsRepository implements CreditsRepository {
  constructor(private readonly db: Db) {}

  async wallet(ownerId: string, now: Date): Promise<WalletView> {
    const r = await this.db.execute(
      sql`select w.*,(select coalesce(sum(plan),0) from credit_holds h where h.owner_id=w.owner_id and h.expires_at>${now.toISOString()}::timestamptz) as held_plan,
        (select coalesce(sum(bonus),0) from credit_holds h where h.owner_id=w.owner_id and h.expires_at>${now.toISOString()}::timestamptz) as held_bonus,
        (select coalesce(sum(purchased),0) from credit_holds h where h.owner_id=w.owner_id and h.expires_at>${now.toISOString()}::timestamptz) as held_purchased
        from credit_wallets w where w.owner_id=${ownerId}`,
    );
    const row = r.rows[0];
    if (!row)
      return {
        balances: zero(),
        free: zero(),
        planExpiresAt: null,
        welcomeStatus: null,
        welcomeReason: null,
        welcomeIpHash: null,
      };
    const planExpiresAt = isoOrNull(row.plan_expires_at);
    const expired =
      planExpiresAt !== null && Date.parse(planExpiresAt) <= now.getTime();
    // Expired plan credits read as 0 even before the next write records the expiry.
    const balances = {
      plan: expired ? 0 : Number(row.plan_balance),
      bonus: Number(row.bonus_balance),
      purchased: Number(row.purchased_balance),
    };
    return {
      balances,
      free: available(
        {
          balances,
          held: {
            plan: Number(row.held_plan),
            bonus: Number(row.held_bonus),
            purchased: Number(row.held_purchased),
          },
          planExpiresAt,
        },
        now,
      ),
      planExpiresAt: expired ? null : planExpiresAt,
      welcomeStatus: (row.welcome_status as WelcomeStatus | null) ?? null,
      welcomeReason: (row.welcome_reason as WelcomeReason | null) ?? null,
      welcomeIpHash: (row.welcome_ip_hash as string | null) ?? null,
    };
  }

  reserve(
    ownerId: string,
    amount: number,
    reason: string,
    now: Date,
    ttlMs: number,
  ): Promise<Hold | undefined> {
    return this.db.transaction(async (tx) => {
      const wallet = await lockWallet(tx, ownerId, now);
      const buckets = allocate(available(wallet, now), amount);
      if (!buckets) return undefined;
      const id = randomUUID();
      await tx.execute(
        sql`insert into credit_holds(id,owner_id,plan,bonus,purchased,reason,expires_at) values(${id},${ownerId},${buckets.plan},${buckets.bonus},${buckets.purchased},${reason},${new Date(now.getTime() + ttlMs).toISOString()}::timestamptz)`,
      );
      return { id, buckets };
    });
  }

  commit(
    ownerId: string,
    hold: Hold & { amount: number },
    reason: "review_quick" | "review_deep",
    ref: string,
    now: Date,
  ): Promise<Buckets | undefined> {
    return this.db.transaction(async (tx) => {
      // Lock first: expired holds are cleaned here, so a late commit uses free credits.
      const wallet = await lockWallet(tx, ownerId, now);
      const held = await tx.execute(
        sql`delete from credit_holds where id=${hold.id} and owner_id=${ownerId} returning plan,bonus,purchased`,
      );
      const buckets = held.rows[0]
        ? {
            plan: Number(held.rows[0].plan),
            bonus: Number(held.rows[0].bonus),
            purchased: Number(held.rows[0].purchased),
          }
        : allocate(available(wallet, now), hold.amount);
      if (!buckets) return undefined;
      const charged = zero();
      for (const bucket of BUCKETS) {
        const amount = Math.min(buckets[bucket], wallet.balances[bucket]);
        if (amount <= 0) continue;
        if (
          await appendLedger(tx, {
            ownerId,
            delta: -amount,
            reason,
            bucket,
            ref: `${ref}:${bucket}`,
          })
        ) {
          await addToBucket(tx, ownerId, bucket, -amount);
          charged[bucket] = amount;
        }
      }
      return charged;
    });
  }

  async release(ownerId: string, holdId: string): Promise<void> {
    await this.db.execute(
      sql`delete from credit_holds where id=${holdId} and owner_id=${ownerId}`,
    );
  }

  credit(entry: CreditEntry, now: Date): Promise<CreditResult> {
    return this.db.transaction(async (tx) => {
      const wallet = await lockWallet(tx, entry.ownerId, now);
      if (
        entry.delta < 0 &&
        available(wallet, now)[entry.bucket] < -entry.delta
      )
        return "insufficient";
      const fresh = await appendLedger(tx, {
        ownerId: entry.ownerId,
        delta: entry.delta,
        reason: entry.reason,
        bucket: entry.bucket,
        ref: entry.ref ?? null,
        note: entry.note ?? null,
        adminId: entry.adminId ?? null,
        expiresAt: entry.expiresAt ?? null,
      });
      if (!fresh) return "duplicate";
      if (entry.reason === "plan_grant")
        await replacePlanCredits(
          tx,
          entry.ownerId,
          wallet,
          entry.delta,
          entry.expiresAt ?? null,
          entry.ref ?? randomUUID(),
        );
      else await addToBucket(tx, entry.ownerId, entry.bucket, entry.delta);
      return "ok";
    });
  }

  async ledger(ownerId: string, limit: number): Promise<LedgerEntryDto[]> {
    const r = await this.db.execute(
      sql`select id,delta,reason,bucket,ref,note,expires_at,created_at from credit_ledger where owner_id=${ownerId} order by created_at desc, id limit ${limit}`,
    );
    return r.rows.map((row) => ({
      id: row.id as string,
      delta: Number(row.delta),
      reason: row.reason as CreditReason,
      bucket: row.bucket as Bucket,
      ...(row.ref ? { ref: row.ref as string } : {}),
      ...(row.note ? { note: row.note as string } : {}),
      ...(row.expires_at ? { expiresAt: isoDate(row.expires_at) } : {}),
      createdAt: isoDate(row.created_at),
    }));
  }

  async ledgerTotals(ownerId: string): Promise<Buckets> {
    const r = await this.db.execute(
      sql`select bucket,sum(delta) as total from credit_ledger where owner_id=${ownerId} group by bucket`,
    );
    const out = zero();
    for (const row of r.rows) out[row.bucket as Bucket] = Number(row.total);
    return out;
  }

  async setWelcome(
    ownerId: string,
    status: WelcomeStatus,
    reason: WelcomeReason | null,
    ipHash?: string,
  ): Promise<void> {
    await this.db.execute(
      sql`insert into credit_wallets(owner_id,welcome_status,welcome_reason,welcome_ip_hash) values(${ownerId},${status},${reason},${ipHash ?? null})
        on conflict(owner_id) do update set welcome_status=excluded.welcome_status,welcome_reason=excluded.welcome_reason,welcome_ip_hash=coalesce(excluded.welcome_ip_hash,credit_wallets.welcome_ip_hash),updated_at=now()
        where credit_wallets.welcome_status is distinct from 'granted'`,
    );
  }
}
