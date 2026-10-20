import { sql } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";
import type { SettingsDto } from "./privacy.dto.js";

/** Port used by uploads and the worker: whether the owner currently consents to telemetry. */
export interface ConsentLookup {
  settings(ownerId: string): Promise<SettingsDto>;
}

export interface PrivacyRepository extends ConsentLookup {
  /** Saves consent/retention; withdrawing telemetry consent fails queued/processing jobs. */
  update(ownerId: string, settings: SettingsDto): Promise<void>;
  /**
   * Deletes the account (cascades to its uploads) after scheduling its demo files for deletion,
   * then the matches no other account references (their files go to the outbox too).
   */
  deleteAccount(ownerId: string): Promise<void>;
}

export class PgPrivacyRepository implements PrivacyRepository {
  constructor(private readonly db: Db) {}

  async settings(ownerId: string): Promise<SettingsDto> {
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

  async update(ownerId: string, s: SettingsDto): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`update users set telemetry_consent=${s.telemetryConsent},analytics_consent=${s.analyticsConsent},retention_days=${s.retentionDays} where id=${ownerId}`,
      );
      if (!s.telemetryConsent)
        await tx.execute(
          sql`update demo_jobs set status='failed',error='Telemetry consent withdrawn',lease_token=null,lease_until=null,updated_at=now() where upload_id in (select id from uploads where owner_id=${ownerId}) and kind<>'reprocess' and status in('queued','processing')`,
        );
    });
  }

  async deleteAccount(ownerId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`insert into file_deletions(object_key) select object_key from uploads where owner_id=${ownerId} on conflict(object_key) do update set processed_at=null`,
      );
      await tx.execute(sql`delete from users where id=${ownerId}`);
      await tx.execute(sql`select delete_unreferenced_matches()`);
    });
  }
}
