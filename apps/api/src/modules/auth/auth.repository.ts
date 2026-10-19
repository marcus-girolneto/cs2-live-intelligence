import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { AdminBootstrap } from "../../config/env.js";
import { digest, secret } from "../../shared/crypto/tokens.js";
import type { Db } from "../../shared/db/database.js";
import type { SessionAuthenticator } from "../../shared/http/guards.js";

/** Single-use code handed to the browser after Steam sign-in, bound to an HttpOnly cookie. */
export interface LoginCode {
  code: string;
  binding: string;
  ownerId: string;
}

/** Sessions, OpenID state/nonces and login codes. Only digests of secrets are stored. */
export interface AuthRepository extends SessionAuthenticator {
  /** Deletes the session; returns its owner, if any. */
  logout(token: string): Promise<string | undefined>;
  createOpenIdState(): Promise<string>;
  /** Consumes state + nonce, upserts the Steam user (admin bootstrap) and issues a login code. */
  finishOpenId(
    state: string,
    nonce: string,
    steamId: string,
    admin: AdminBootstrap,
  ): Promise<LoginCode | undefined>;
  /** Trades a login code + binding for a 30-day application session token. */
  exchange(
    code: string,
    binding: string,
  ): Promise<{ token: string } | undefined>;
}

/** Advisory lock shared by every statement that may change who is admin. */
export const ADMIN_ROLE_LOCK = 726221003;

export class PgAuthRepository implements AuthRepository {
  constructor(private readonly db: Db) {}

  async ownerForToken(token: string): Promise<string | undefined> {
    const r = await this.db.execute(
      sql`select owner_id from app_sessions where token_hash=${digest(token)} and expires_at>now()`,
    );
    return r.rows[0]?.owner_id as string | undefined;
  }

  async logout(token: string): Promise<string | undefined> {
    const r = await this.db.execute(
      sql`delete from app_sessions where token_hash=${digest(token)} returning owner_id`,
    );
    return r.rows[0]?.owner_id as string | undefined;
  }

  async createOpenIdState(): Promise<string> {
    const state = secret();
    await this.db.execute(
      sql`insert into openid_states(state_hash,expires_at) values(${digest(state)},now()+interval '10 minutes')`,
    );
    return state;
  }

  finishOpenId(
    state: string,
    nonce: string,
    steamId: string,
    admin: AdminBootstrap,
  ): Promise<LoginCode | undefined> {
    return this.db.transaction(async (tx) => {
      const used = await tx.execute(
        sql`delete from openid_states where state_hash=${digest(state)} and expires_at>now() returning state_hash`,
      );
      if (!used.rows.length) return undefined;
      const unique = await tx.execute(
        sql`insert into openid_nonces(nonce) values(${nonce}) on conflict do nothing returning nonce`,
      );
      if (!unique.rows.length) return undefined;
      const user = await tx.execute(
        sql`insert into users(id,steam_id,last_login_at) values(${randomUUID()},${steamId},now()) on conflict(steam_id) do update set last_login_at=now() returning id`,
      );
      const ownerId = user.rows[0]!.id as string;
      // Admin bootstrap only ever applies to Steam sign-ins (never dev/local accounts).
      if (admin.steamIds.has(steamId))
        await tx.execute(
          sql`update users set role='admin' where id=${ownerId}`,
        );
      else if (admin.firstLogin) {
        await tx.execute(sql`select pg_advisory_xact_lock(${ADMIN_ROLE_LOCK})`);
        await tx.execute(
          sql`update users set role='admin' where id=${ownerId} and not exists(select 1 from users where role='admin')`,
        );
      }
      const code = secret();
      const binding = secret();
      await tx.execute(
        sql`insert into auth_codes(code_hash,binding_hash,owner_id,expires_at) values(${digest(code)},${digest(binding)},${ownerId},now()+interval '60 seconds')`,
      );
      return { code, binding, ownerId };
    });
  }

  exchange(
    code: string,
    binding: string,
  ): Promise<{ token: string } | undefined> {
    return this.db.transaction(async (tx) => {
      const r = await tx.execute(
        sql`delete from auth_codes where code_hash=${digest(code)} and binding_hash=${digest(binding)} and expires_at>now() returning owner_id`,
      );
      if (!r.rows.length) return undefined;
      const token = secret();
      await tx.execute(
        sql`insert into app_sessions(token_hash,owner_id,expires_at) values(${digest(token)},${r.rows[0]!.owner_id},now()+interval '30 days')`,
      );
      return { token };
    });
  }
}
