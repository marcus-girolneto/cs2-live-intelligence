import { sql } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";
import { addToBucket, appendLedger, lockWallet } from "./wallet-sql.js";

export type WelcomeGrantResult =
  "granted" | "already_claimed" | "network_limit";
export type WelcomeGrant = {
  ownerId: string;
  steamIdHash: string;
  ipPrefixHash: string | null;
  credits: number;
  maxPerNetwork: number;
  windowDays: number;
};

/**
 * One welcome grant per Steam id ever (welcome_grants survives account deletion) and at most N
 * grants per network prefix per window. The check, the grant row, the ledger entry and the
 * wallet update commit together, serialized per Steam id and per network by advisory locks.
 */
export interface WelcomeRepository {
  grant(request: WelcomeGrant, now: Date): Promise<WelcomeGrantResult>;
  claimed(steamIdHash: string): Promise<boolean>;
}

const WELCOME_LOCK = 726221020;

export class PgWelcomeRepository implements WelcomeRepository {
  constructor(private readonly db: Db) {}

  async claimed(steamIdHash: string): Promise<boolean> {
    const r = await this.db.execute(
      sql`select 1 from welcome_grants where steam_id_hash=${steamIdHash}`,
    );
    return r.rows.length > 0;
  }

  grant(request: WelcomeGrant, now: Date): Promise<WelcomeGrantResult> {
    return this.db.transaction(async (tx) => {
      // Lock order: network, then Steam id (always the same order: no deadlocks).
      if (request.ipPrefixHash)
        await tx.execute(
          sql`select pg_advisory_xact_lock(${WELCOME_LOCK}, hashtext(${`net:${request.ipPrefixHash}`}))`,
        );
      await tx.execute(
        sql`select pg_advisory_xact_lock(${WELCOME_LOCK}, hashtext(${`steam:${request.steamIdHash}`}))`,
      );
      if (await this.claimedIn(tx, request.steamIdHash))
        return "already_claimed";
      if (request.ipPrefixHash) {
        const r = await tx.execute(
          sql`select count(*) as n from welcome_grants where ip_prefix_hash=${request.ipPrefixHash} and granted_at>${now.toISOString()}::timestamptz - make_interval(days => ${request.windowDays})`,
        );
        if (Number(r.rows[0]!.n) >= request.maxPerNetwork)
          return "network_limit";
      }
      await tx.execute(
        sql`insert into welcome_grants(steam_id_hash,granted_at,ip_prefix_hash) values(${request.steamIdHash},${now.toISOString()}::timestamptz,${request.ipPrefixHash})`,
      );
      await lockWallet(tx, request.ownerId, now);
      if (
        request.credits > 0 &&
        (await appendLedger(tx, {
          ownerId: request.ownerId,
          delta: request.credits,
          reason: "welcome",
          bucket: "bonus",
          ref: "welcome",
        }))
      )
        await addToBucket(tx, request.ownerId, "bonus", request.credits);
      await tx.execute(
        sql`update credit_wallets set welcome_status='granted',welcome_reason=null,updated_at=now() where owner_id=${request.ownerId}`,
      );
      return "granted";
    });
  }

  private async claimedIn(tx: Db, hash: string): Promise<boolean> {
    const r = await tx.execute(
      sql`select 1 from welcome_grants where steam_id_hash=${hash}`,
    );
    return r.rows.length > 0;
  }
}
