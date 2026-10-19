import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";
import { isoOrNull } from "../../shared/db/rows.js";
import {
  BUCKETS,
  type Bucket,
  type Buckets,
  type CreditReason,
} from "./credits.dto.js";

/**
 * SQL building blocks shared by the credit repositories. Every function runs inside the
 * caller's transaction after `lockWallet`, so the materialized wallet and the append-only
 * ledger always change together (the ledger is the source of truth).
 */
export type LockedWallet = {
  balances: Buckets;
  /** Credits reserved by unexpired holds, per bucket. */
  held: Buckets;
  planExpiresAt: string | null;
};
export const zero = (): Buckets => ({ plan: 0, bonus: 0, purchased: 0 });
const COLUMN = {
  plan: "plan_balance",
  bonus: "bonus_balance",
  purchased: "purchased_balance",
} as const;

/** Creates the wallet row if needed and locks it (SELECT … FOR UPDATE) for this transaction. */
export async function lockWallet(
  tx: Db,
  ownerId: string,
  now: Date,
): Promise<LockedWallet> {
  await tx.execute(
    sql`insert into credit_wallets(owner_id) values(${ownerId}) on conflict(owner_id) do nothing`,
  );
  const r = await tx.execute(
    sql`select plan_balance,bonus_balance,purchased_balance,plan_expires_at from credit_wallets where owner_id=${ownerId} for update`,
  );
  const row = r.rows[0]!;
  await tx.execute(
    sql`delete from credit_holds where owner_id=${ownerId} and expires_at<=${now.toISOString()}::timestamptz`,
  );
  const h = await tx.execute(
    sql`select coalesce(sum(plan),0) as plan,coalesce(sum(bonus),0) as bonus,coalesce(sum(purchased),0) as purchased from credit_holds where owner_id=${ownerId}`,
  );
  const wallet: LockedWallet = {
    balances: {
      plan: Number(row.plan_balance),
      bonus: Number(row.bonus_balance),
      purchased: Number(row.purchased_balance),
    },
    held: {
      plan: Number(h.rows[0]!.plan),
      bonus: Number(h.rows[0]!.bonus),
      purchased: Number(h.rows[0]!.purchased),
    },
    planExpiresAt: isoOrNull(row.plan_expires_at),
  };
  return expirePlan(tx, ownerId, wallet, now);
}

/** Plan credits past their period end expire (ledger "expire" row), unless a hold uses them. */
async function expirePlan(
  tx: Db,
  ownerId: string,
  wallet: LockedWallet,
  now: Date,
): Promise<LockedWallet> {
  const expired =
    wallet.planExpiresAt !== null &&
    Date.parse(wallet.planExpiresAt) <= now.getTime();
  if (!expired || wallet.balances.plan === 0 || wallet.held.plan > 0)
    return wallet;
  await appendLedger(tx, {
    ownerId,
    delta: -wallet.balances.plan,
    reason: "expire",
    bucket: "plan",
    ref: `expire:${wallet.planExpiresAt}`,
  });
  await tx.execute(
    sql`update credit_wallets set plan_balance=0,updated_at=now() where owner_id=${ownerId}`,
  );
  return { ...wallet, balances: { ...wallet.balances, plan: 0 } };
}

/** Free credits per bucket (expired plan credits are never available). */
export function available(wallet: LockedWallet, now: Date): Buckets {
  const planOpen =
    wallet.planExpiresAt === null ||
    Date.parse(wallet.planExpiresAt) > now.getTime();
  return {
    plan: planOpen ? Math.max(0, wallet.balances.plan - wallet.held.plan) : 0,
    bonus: Math.max(0, wallet.balances.bonus - wallet.held.bonus),
    purchased: Math.max(0, wallet.balances.purchased - wallet.held.purchased),
  };
}

/** Splits `amount` over the buckets in spend order; undefined when it does not fit. */
export function allocate(free: Buckets, amount: number): Buckets | undefined {
  const out = zero();
  let left = amount;
  for (const bucket of BUCKETS) {
    const take = Math.min(left, free[bucket]);
    out[bucket] = take;
    left -= take;
  }
  return left === 0 ? out : undefined;
}

export type LedgerRow = {
  ownerId: string;
  delta: number;
  reason: CreditReason;
  bucket: Bucket;
  ref?: string | null;
  note?: string | null;
  adminId?: string | null;
  expiresAt?: string | null;
};
/** Appends one ledger row; false when the idempotency key (owner, reason, ref) already exists. */
export async function appendLedger(tx: Db, row: LedgerRow): Promise<boolean> {
  const r = await tx.execute(
    sql`insert into credit_ledger(id,owner_id,delta,reason,bucket,ref,note,admin_id,expires_at) values(${randomUUID()},${row.ownerId},${row.delta},${row.reason},${row.bucket},${row.ref ?? null},${row.note ?? null},${row.adminId ?? null},${row.expiresAt ?? null}::timestamptz)
      on conflict (owner_id,reason,ref) where ref is not null do nothing returning id`,
  );
  return r.rows.length > 0;
}

/** Adds `delta` to one bucket of the locked wallet (the CHECK constraint forbids negatives). */
export async function addToBucket(
  tx: Db,
  ownerId: string,
  bucket: Bucket,
  delta: number,
): Promise<void> {
  const column = sql.raw(COLUMN[bucket]);
  await tx.execute(
    sql`update credit_wallets set ${column}=${column}+${delta},updated_at=now() where owner_id=${ownerId}`,
  );
}

/** Replaces the plan bucket (new period): leftover plan credits expire, no rollover. */
export async function replacePlanCredits(
  tx: Db,
  ownerId: string,
  wallet: LockedWallet,
  credits: number,
  expiresAt: string | null,
  ref: string,
): Promise<void> {
  if (wallet.balances.plan > 0)
    await appendLedger(tx, {
      ownerId,
      delta: -wallet.balances.plan,
      reason: "expire",
      bucket: "plan",
      ref: `replaced:${ref}`,
    });
  await tx.execute(
    sql`update credit_wallets set plan_balance=${credits},plan_expires_at=${expiresAt}::timestamptz,updated_at=now() where owner_id=${ownerId}`,
  );
}
