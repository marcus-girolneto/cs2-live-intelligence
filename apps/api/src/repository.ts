import { randomBytes, randomUUID, createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import type { LiveState, TelemetryEnvelope } from "@cs2/contracts";
import * as schema from "./schema.js";
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const secret = () => randomBytes(32).toString("base64url");
export interface Settings {
  telemetryConsent: boolean;
  analyticsConsent: boolean;
  retentionDays: number;
}
export interface StoredSession {
  ownerId: string;
  deviceId: string;
  state: LiveState;
}
export interface DeviceIdentity {
  deviceId: string;
  ownerId: string;
  tokenHash?: string;
}
export class PgRepository {
  readonly pool: Pool;
  readonly db;
  constructor(url: string) {
    this.pool = new Pool({
      connectionString: url,
      max: 10,
      connectionTimeoutMillis: 5000,
    });
    this.db = drizzle(this.pool, { schema });
  }
  async migrate() {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(726221001)");
      await client.query(
        "CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
      );
      const directory = new URL("../migrations/", import.meta.url);
      for (const filename of (await readdir(directory))
        .filter((name) => name.endsWith(".sql"))
        .sort()) {
        const applied = await client.query(
          "SELECT version FROM schema_migrations WHERE version=$1",
          [filename],
        );
        if (!applied.rows.length) {
          await client.query(
            await readFile(new URL(filename, directory), "utf8"),
          );
          await client.query(
            "INSERT INTO schema_migrations(version) VALUES($1)",
            [filename],
          );
        }
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async close() {
    await this.pool.end();
  }
  async ready() {
    await this.db.execute(sql`select 1`);
  }
  async seedDev(
    ownerId: string,
    ownerToken: string,
    deviceId: string,
    deviceToken: string,
  ) {
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`insert into users(id,telemetry_consent) values(${ownerId},true) on conflict(id) do nothing`,
      );
      await tx.execute(
        sql`insert into app_sessions(token_hash,owner_id,expires_at) values(${digest(ownerToken)},${ownerId},now()+interval '30 days') on conflict(token_hash) do update set expires_at=excluded.expires_at`,
      );
      await tx.execute(
        sql`insert into devices(id,owner_id,name,token_hash) values(${deviceId},${ownerId},'Development collector',${digest(deviceToken)}) on conflict(id) do nothing`,
      );
    });
  }
  async owner(token: string) {
    const r = await this.db.execute(
      sql`select owner_id from app_sessions where token_hash=${digest(token)} and expires_at>now()`,
    );
    return r.rows[0]?.owner_id as string | undefined;
  }
  async device(token: string): Promise<DeviceIdentity | undefined> {
    const r = await this.db.execute(
      sql`select id,owner_id,token_hash from devices where token_hash=${digest(token)} and revoked_at is null`,
    );
    const row = r.rows[0];
    return row
      ? {
          deviceId: row.id as string,
          ownerId: row.owner_id as string,
          tokenHash: row.token_hash as string,
        }
      : undefined;
  }
  async me(ownerId: string) {
    const r = await this.db.execute(
      sql`select steam_id from users where id=${ownerId}`,
    );
    return {
      ownerId,
      ...(r.rows[0]?.steam_id ? { steamId: r.rows[0].steam_id as string } : {}),
    };
  }
  async settings(ownerId: string): Promise<Settings> {
    const r = await this.db.execute(
      sql`select telemetry_consent,analytics_consent,retention_days from users where id=${ownerId}`,
    );
    const row = r.rows[0];
    if (!row) throw new Error("Unknown account");
    return {
      telemetryConsent: row.telemetry_consent as boolean,
      analyticsConsent: row.analytics_consent as boolean,
      retentionDays: row.retention_days as number,
    };
  }
  async updateSettings(ownerId: string, s: Settings) {
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`update users set telemetry_consent=${s.telemetryConsent},analytics_consent=${s.analyticsConsent},retention_days=${s.retentionDays} where id=${ownerId}`,
      );
      if (!s.telemetryConsent)
        await tx.execute(
          sql`update demo_jobs set status='failed',error='Telemetry consent withdrawn',lease_token=null,lease_until=null,updated_at=now() where owner_id=${ownerId} and status in('queued','processing')`,
        );
    });
    return s;
  }
  async session(id: string): Promise<StoredSession | undefined> {
    const r = await this.db.execute(
      sql`select owner_id,device_id,state from live_sessions where id=${id}`,
    );
    const row = r.rows[0];
    return row
      ? {
          ownerId: row.owner_id as string,
          deviceId: row.device_id as string,
          state: row.state as LiveState,
        }
      : undefined;
  }
  async ingest(
    event: TelemetryEnvelope,
    state: LiveState,
    device: DeviceIdentity,
  ): Promise<"accepted" | "duplicate" | "ignored" | "forbidden" | "consent"> {
    return this.db.transaction(async (tx) => {
      // Serializes identity revocation/rotation and all writers to this session before dedup+sequence decisions.
      const identity = await tx.execute(
        sql`select d.id,u.telemetry_consent from devices d join users u on u.id=d.owner_id where d.id=${device.deviceId} and d.owner_id=${device.ownerId} and d.revoked_at is null and d.token_hash=${device.tokenHash ?? ""} for update of d,u`,
      );
      if (!identity.rows.length) return "forbidden";
      if (!identity.rows[0].telemetry_consent) return "consent";
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${event.sessionId},0))`,
      );
      const previous = await tx.execute(
        sql`select owner_id,device_id,sequence from live_sessions where id=${event.sessionId}`,
      );
      const p = previous.rows[0];
      if (
        p &&
        (p.owner_id !== device.ownerId || p.device_id !== device.deviceId)
      )
        return "forbidden";
      const dedup = await tx.execute(
        sql`insert into telemetry_events(device_id,event_id,owner_id) values(${device.deviceId},${event.eventId},${device.ownerId}) on conflict do nothing returning event_id`,
      );
      if (!dedup.rows.length) return "duplicate";
      if (p && Number(p.sequence) >= event.sequence) return "ignored";
      await tx.execute(
        sql`insert into live_sessions(id,owner_id,device_id,sequence,state) values(${event.sessionId},${device.ownerId},${device.deviceId},${event.sequence},${JSON.stringify(state)}::jsonb) on conflict(id) do update set sequence=excluded.sequence,state=excluded.state,updated_at=now()`,
      );
      return "accepted";
    });
  }
  async pair(ownerId: string, name: string) {
    const code = secret();
    const expiresAt = new Date(Date.now() + 300000).toISOString();
    const result = await this.db.execute(
      sql`insert into pairing_codes(code_hash,owner_id,name,expires_at) select ${digest(code)},${ownerId},${name},${expiresAt}::timestamptz where (select count(*) from pairing_codes where owner_id=${ownerId} and expires_at>now())<10 returning code_hash`,
    );
    if (!result.rows.length) throw new Error("Pairing limit reached");
    return { code, expiresAt };
  }
  async claim(code: string) {
    return this.db.transaction(async (tx) => {
      const r = await tx.execute(
        sql`delete from pairing_codes where code_hash=${digest(code)} and expires_at>now() returning owner_id,name,device_id`,
      );
      const row = r.rows[0];
      if (!row) return undefined;
      const deviceId = (row.device_id as string) ?? randomUUID();
      const token = secret();
      if (row.device_id) {
        const updated = await tx.execute(
          sql`update devices set token_hash=${digest(token)} where id=${deviceId} and owner_id=${row.owner_id} and revoked_at is null returning id`,
        );
        if (!updated.rows.length) return undefined;
      } else {
        await tx.execute(
          sql`select id from users where id=${row.owner_id} for update`,
        );
        const count = await tx.execute(
          sql`select count(*) as total from devices where owner_id=${row.owner_id}`,
        );
        if (Number(count.rows[0].total) >= 100) return undefined;
        await tx.execute(
          sql`insert into devices(id,owner_id,name,token_hash) values(${deviceId},${row.owner_id},${row.name},${digest(token)})`,
        );
      }

      return { deviceId, token };
    });
  }
  async devices(ownerId: string) {
    const r = await this.db.execute(
      sql`select id,name,created_at,revoked_at from devices where owner_id=${ownerId} order by created_at desc limit 100`,
    );
    return {
      devices: r.rows.map((row) => ({
        deviceId: row.id,
        name: row.name,
        createdAt: new Date(row.created_at as string).toISOString(),
        revokedAt: row.revoked_at
          ? new Date(row.revoked_at as string).toISOString()
          : null,
      })),
    };
  }
  async rotate(ownerId: string, id: string) {
    return this.db.transaction(async (tx) => {
      const device = await tx.execute(
        sql`select id,name from devices where id=${id} and owner_id=${ownerId} and revoked_at is null for update`,
      );
      if (!device.rows.length) return undefined;
      await tx.execute(
        sql`update devices set token_hash=${digest(secret())} where id=${id}`,
      );
      await tx.execute(sql`delete from pairing_codes where device_id=${id}`);
      const code = secret();
      const expiresAt = new Date(Date.now() + 300000).toISOString();
      await tx.execute(
        sql`insert into pairing_codes(code_hash,owner_id,name,device_id,expires_at) values(${digest(code)},${ownerId},${device.rows[0].name},${id},${expiresAt}::timestamptz)`,
      );
      return { code, expiresAt };
    });
  }
  async revoke(ownerId: string, id: string) {
    const r = await this.db.execute(
      sql`update devices set revoked_at=now(),token_hash=${digest(secret())} where id=${id} and owner_id=${ownerId} returning id`,
    );
    return !!r.rows.length;
  }
  async deleteAccount(ownerId: string) {
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`insert into file_deletions(object_key) select object_key from demo_jobs where owner_id=${ownerId} on conflict do nothing`,
      );
      await tx.execute(sql`delete from users where id=${ownerId}`);
    });
  }
  async createOpenIdState() {
    const state = secret();
    await this.db.execute(
      sql`insert into openid_states(state_hash,expires_at) values(${digest(state)},now()+interval '10 minutes')`,
    );
    return state;
  }
  async finishOpenId(state: string, nonce: string, steamId: string) {
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
        sql`insert into users(id,steam_id) values(${randomUUID()},${steamId}) on conflict(steam_id) do update set steam_id=excluded.steam_id returning id`,
      );
      const code = secret();
      const binding = secret();
      await tx.execute(
        sql`insert into auth_codes(code_hash,binding_hash,owner_id,expires_at) values(${digest(code)},${digest(binding)},${user.rows[0].id},now()+interval '60 seconds')`,
      );
      return { code, binding };
    });
  }
  async exchange(code: string, binding: string) {
    return this.db.transaction(async (tx) => {
      const r = await tx.execute(
        sql`delete from auth_codes where code_hash=${digest(code)} and binding_hash=${digest(binding)} and expires_at>now() returning owner_id`,
      );
      if (!r.rows.length) return undefined;
      const token = secret();
      await tx.execute(
        sql`insert into app_sessions(token_hash,owner_id,expires_at) values(${digest(token)},${r.rows[0].owner_id},now()+interval '30 days')`,
      );
      return { token };
    });
  }
  async logout(token: string) {
    const r = await this.db.execute(
      sql`delete from app_sessions where token_hash=${digest(token)} returning owner_id`,
    );
    return r.rows[0]?.owner_id as string | undefined;
  }
  async createJob(
    ownerId: string,
    file: {
      id: string;
      filename: string;
      objectKey: string;
      checksum: string;
      size: number;
    },
  ) {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(726221002)`);
      const account = await tx.execute(
        sql`select telemetry_consent from users where id=${ownerId} for update`,
      );
      if (!account.rows[0]?.telemetry_consent)
        throw new Error("Consent required");
      const quota = await tx.execute(
        sql`select count(*) filter(where created_at>now()-interval '24 hours') as daily,count(*) filter(where status in ('queued','processing')) as active,coalesce(sum(size),0) as bytes from demo_jobs where owner_id=${ownerId}`,
      );
      const q = quota.rows[0];
      if (
        Number(q.daily) >= 10 ||
        Number(q.active) >= 2 ||
        Number(q.bytes) + file.size > 512 * 1024 * 1024
      )
        throw new Error("Upload quota reached");
      const globalQuota = await tx.execute(
        sql`select coalesce(sum(size),0) as bytes,count(*) as total from demo_jobs`,
      );
      if (
        Number(globalQuota.rows[0].bytes) + file.size >
          2 * 1024 * 1024 * 1024 ||
        Number(globalQuota.rows[0].total) >= 10000
      )
        throw new Error("Storage quota reached");
      await tx.execute(
        sql`insert into demo_jobs(id,owner_id,filename,object_key,checksum,size) values(${file.id},${ownerId},${file.filename},${file.objectKey},${file.checksum},${file.size})`,
      );
      return { id: file.id, status: "queued" };
    });
  }
  async matches(ownerId: string) {
    const r = await this.db.execute(
      sql`select id,filename,status,created_at,error from demo_jobs where owner_id=${ownerId} order by created_at desc limit 100`,
    );
    return { matches: r.rows.map((row) => this.jobView(row)) };
  }
  private jobView(row: Record<string, unknown>) {
    return {
      id: row.id as string,
      filename: row.filename as string,
      status: row.status as string,
      createdAt: new Date(row.created_at as string).toISOString(),
      ...(row.error ? { error: row.error as string } : {}),
      ...(row.status === "complete" ? { analysisId: row.id as string } : {}),
    };
  }
  async match(ownerId: string, id: string) {
    const r = await this.db.execute(
      sql`select id,filename,status,created_at,error from demo_jobs where owner_id=${ownerId} and id=${id}`,
    );
    return r.rows[0] ? this.jobView(r.rows[0]) : undefined;
  }
  async analysis(ownerId: string, id: string) {
    const r = await this.db.execute(
      sql`select id,analysis,coaching from demo_jobs where owner_id=${ownerId} and id=${id} and status='complete'`,
    );
    return r.rows[0]
      ? { id, analysis: r.rows[0].analysis, coaching: r.rows[0].coaching }
      : undefined;
  }
  async claimJob() {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`update demo_jobs set status='failed',error='Worker retry limit exceeded',updated_at=now() where status='processing' and lease_until<now() and attempts>=2`,
      );
      const r = await tx.execute(
        sql`select j.id,j.owner_id,j.object_key from demo_jobs j join users u on u.id=j.owner_id where u.telemetry_consent and (j.status='queued' or (j.status='processing' and j.lease_until<now() and j.attempts<2)) order by j.created_at for update of j skip locked limit 1`,
      );
      const job = r.rows[0];
      if (!job) return undefined;
      const leaseToken = secret();
      await tx.execute(
        sql`update demo_jobs set status='processing',attempts=attempts+1,lease_token=${leaseToken},lease_until=now()+interval '180 seconds',updated_at=now() where id=${job.id}`,
      );
      return {
        id: job.id as string,
        ownerId: job.owner_id as string,
        objectKey: job.object_key as string,
        leaseToken,
      };
    });
  }
  async reserveProvider(ownerId: string) {
    const r = await this.db.execute(
      sql`insert into provider_usage(owner_id,day,requests) select ${ownerId},CURRENT_DATE,1 from users where id=${ownerId} and telemetry_consent on conflict(owner_id,day) do update set requests=provider_usage.requests+1 where provider_usage.requests<3 returning requests`,
    );
    return r.rows.length > 0;
  }
  async finishJob(
    id: string,
    leaseToken: string,
    result: { analysis: unknown; coaching: unknown } | { error: string },
  ) {
    if ("error" in result)
      await this.db.execute(
        sql`update demo_jobs set status='failed',error=${result.error},lease_until=null,lease_token=null,updated_at=now() where id=${id} and lease_token=${leaseToken} and status='processing'`,
      );
    else
      await this.db.execute(
        sql`update demo_jobs set status='complete',analysis=${JSON.stringify(result.analysis)}::jsonb,coaching=${JSON.stringify(result.coaching)}::jsonb,error=null,lease_until=null,lease_token=null,updated_at=now() where id=${id} and lease_token=${leaseToken} and status='processing' and exists(select 1 from users where id=demo_jobs.owner_id and telemetry_consent)`,
      );
  }
  async feedback(ownerId: string, rating: number, comment?: string) {
    return this.db.transaction(async (tx) => {
      const account = await tx.execute(
        sql`select analytics_consent from users where id=${ownerId} for update`,
      );
      if (!account.rows[0]?.analytics_consent) return undefined;
      const quota = await tx.execute(
        sql`select count(*) as total from feedback where owner_id=${ownerId} and created_at>now()-interval '24 hours'`,
      );
      if (Number(quota.rows[0].total) >= 20) return undefined;
      const id = randomUUID();
      await tx.execute(
        sql`insert into feedback(id,owner_id,rating,comment) values(${id},${ownerId},${rating},${comment ?? null})`,
      );
      return { id };
    });
  }
  async productEvent(
    ownerId: string,
    name: string,
    properties: Record<string, string | number | boolean | null>,
  ) {
    return this.db.transaction(async (tx) => {
      const r = await tx.execute(
        sql`select analytics_consent from users where id=${ownerId} for update`,
      );
      if (!r.rows[0]?.analytics_consent) return false;
      const count = await tx.execute(
        sql`select count(*) as total from product_events where owner_id=${ownerId} and created_at>now()-interval '24 hours'`,
      );
      if (Number(count.rows[0].total) >= 1000) return false;
      await tx.execute(
        sql`insert into product_events(id,owner_id,name,properties) values(${randomUUID()},${ownerId},${name},${JSON.stringify(properties)}::jsonb)`,
      );
      return true;
    });
  }
  async retain() {
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`insert into file_deletions(object_key) select j.object_key from demo_jobs j join users u on u.id=j.owner_id where j.created_at<now()-make_interval(days=>u.retention_days) on conflict do nothing`,
      );
      await tx.execute(
        sql`delete from demo_jobs j using users u where j.owner_id=u.id and j.created_at<now()-make_interval(days=>u.retention_days)`,
      );
      await tx.execute(
        sql`delete from live_sessions s using users u where s.owner_id=u.id and s.updated_at<now()-make_interval(days=>u.retention_days)`,
      );
      await tx.execute(
        sql`delete from telemetry_events e using users u where e.owner_id=u.id and e.created_at<now()-make_interval(days=>u.retention_days)`,
      );
      await tx.execute(
        sql`delete from product_events e using users u where e.owner_id=u.id and e.created_at<now()-make_interval(days=>u.retention_days)`,
      );
      await tx.execute(
        sql`delete from feedback f using users u where f.owner_id=u.id and f.created_at<now()-make_interval(days=>u.retention_days)`,
      );
      await tx.execute(sql`delete from pairing_codes where expires_at<now()`);
      await tx.execute(sql`delete from app_sessions where expires_at<now()`);
      await tx.execute(sql`delete from openid_states where expires_at<now()`);
      await tx.execute(sql`delete from auth_codes where expires_at<now()`);
      await tx.execute(
        sql`delete from openid_nonces where created_at<now()-interval '1 day'`,
      );
      await tx.execute(
        sql`delete from provider_usage where day<CURRENT_DATE-1`,
      );
    });
  }
  async pendingDeletions() {
    const r = await this.db.execute(
      sql`select object_key from file_deletions order by created_at limit 100`,
    );
    return r.rows.map((row) => row.object_key as string);
  }
  async deletedFile(key: string) {
    await this.db.execute(
      sql`delete from file_deletions where object_key=${key}`,
    );
  }
  async knownObjects() {
    const r = await this.db.execute(sql`select object_key from demo_jobs`);
    return new Set(r.rows.map((row) => row.object_key as string));
  }
  async liveHistory(ownerId: string) {
    const r = await this.db.execute(
      sql`select state from live_sessions where owner_id=${ownerId} order by updated_at desc limit 100`,
    );
    return { sessions: r.rows.map((row) => row.state as LiveState) };
  }
}
