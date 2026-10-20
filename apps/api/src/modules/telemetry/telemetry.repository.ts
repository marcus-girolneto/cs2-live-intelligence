import { sql } from "drizzle-orm";
import type { LiveState, TelemetryEnvelope } from "@cs2/contracts";
import type { Db } from "../../shared/db/database.js";
import type { DeviceIdentity } from "../../shared/http/principal.js";

export interface StoredSession {
  ownerId: string;
  deviceId: string;
  state: LiveState;
}
/**
 * accepted: stored; duplicate: event id seen; ignored: older sequence; forbidden: device
 * revoked/rotated or session owned by another device; consent: telemetry consent withdrawn;
 * session_mismatch: (in-memory mode) session bound to another device.
 */
export type IngestResult =
  | "accepted"
  | "duplicate"
  | "ignored"
  | "forbidden"
  | "consent"
  | "session_mismatch";

/** Port: latest state per GSI session plus event de-duplication. */
export interface LiveSessionStore {
  ingest(
    event: TelemetryEnvelope,
    state: LiveState,
    device: DeviceIdentity,
  ): Promise<IngestResult>;
  session(id: string): Promise<StoredSession | undefined>;
  /** The owner's latest 100 sessions, newest first. */
  history(ownerId: string): Promise<LiveState[]>;
  /** Drops expired in-memory entries (no-op for Postgres, which uses retention). */
  prune(): void;
}

export class PgLiveSessionStore implements LiveSessionStore {
  constructor(private readonly db: Db) {}

  ingest(
    event: TelemetryEnvelope,
    state: LiveState,
    device: DeviceIdentity,
  ): Promise<IngestResult> {
    return this.db.transaction(async (tx) => {
      // Serializes identity revocation/rotation and all writers to this session before dedup+sequence decisions.
      const identity = await tx.execute(
        sql`select d.id,u.telemetry_consent from devices d join users u on u.id=d.owner_id where d.id=${device.deviceId} and d.owner_id=${device.ownerId} and d.revoked_at is null and d.token_hash=${device.tokenHash ?? ""} for update of d,u`,
      );
      if (!identity.rows.length) return "forbidden";
      if (!identity.rows[0]!.telemetry_consent) return "consent";
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
        // telemetry_events is partitioned by month, so (device_id, event_id) cannot be a unique
        // key; the device row lock taken above serializes this check-then-insert per device.
        sql`insert into telemetry_events(device_id,event_id,owner_id) select ${device.deviceId},${event.eventId},${device.ownerId} where not exists(select 1 from telemetry_events where device_id=${device.deviceId} and event_id=${event.eventId}) returning event_id`,
      );
      if (!dedup.rows.length) return "duplicate";
      if (p && Number(p.sequence) >= event.sequence) return "ignored";
      await tx.execute(
        sql`insert into live_sessions(id,owner_id,device_id,sequence,state) values(${event.sessionId},${device.ownerId},${device.deviceId},${event.sequence},${JSON.stringify(state)}::jsonb) on conflict(id) do update set sequence=excluded.sequence,state=excluded.state,updated_at=now()`,
      );
      return "accepted";
    });
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

  async history(ownerId: string): Promise<LiveState[]> {
    const r = await this.db.execute(
      sql`select state from live_sessions where owner_id=${ownerId} order by updated_at desc limit 100`,
    );
    return r.rows.map((row) => row.state as LiveState);
  }

  prune(): void {}
}
