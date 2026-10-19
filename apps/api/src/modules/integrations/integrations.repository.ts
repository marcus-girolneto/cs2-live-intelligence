import { sql } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";
import { isoDate, stringOrNull } from "../../shared/db/rows.js";

/** One encrypted secret row (`app_secrets`). */
export interface StoredSecret {
  name: string;
  ciphertext: string;
  last4: string | null;
  updatedAt: string;
  updatedBy: string | null;
}
/** One non-secret settings row (`integration_settings`). */
export interface StoredIntegrationSettings {
  name: string;
  settings: Record<string, unknown>;
  updatedAt: string;
  updatedBy: string | null;
}

/** Persistence of integration secrets (ciphertext only) and non-secret settings. */
export interface IntegrationsRepository {
  secrets(): Promise<StoredSecret[]>;
  saveSecret(
    name: string,
    ciphertext: string,
    last4: string | null,
    updatedBy: string,
  ): Promise<void>;
  deleteSecret(name: string): Promise<void>;
  settings(): Promise<StoredIntegrationSettings[]>;
  saveSettings(
    name: string,
    settings: Record<string, unknown>,
    updatedBy: string,
  ): Promise<void>;
}

export class PgIntegrationsRepository implements IntegrationsRepository {
  constructor(private readonly db: Db) {}

  async secrets(): Promise<StoredSecret[]> {
    const r = await this.db.execute(
      sql`select name,ciphertext,last4,updated_at,updated_by from app_secrets order by name`,
    );
    return r.rows.map((row) => ({
      name: row.name as string,
      ciphertext: row.ciphertext as string,
      last4: stringOrNull(row.last4),
      updatedAt: isoDate(row.updated_at),
      updatedBy: stringOrNull(row.updated_by),
    }));
  }

  async saveSecret(
    name: string,
    ciphertext: string,
    last4: string | null,
    updatedBy: string,
  ): Promise<void> {
    await this.db.execute(
      sql`insert into app_secrets(name,ciphertext,last4,updated_by) values(${name},${ciphertext},${last4},${updatedBy})
        on conflict(name) do update set ciphertext=excluded.ciphertext,last4=excluded.last4,updated_by=excluded.updated_by,updated_at=now()`,
    );
  }

  async deleteSecret(name: string): Promise<void> {
    await this.db.execute(sql`delete from app_secrets where name=${name}`);
  }

  async settings(): Promise<StoredIntegrationSettings[]> {
    const r = await this.db.execute(
      sql`select name,settings,updated_at,updated_by from integration_settings order by name`,
    );
    return r.rows.map((row) => ({
      name: row.name as string,
      settings: (row.settings as Record<string, unknown>) ?? {},
      updatedAt: isoDate(row.updated_at),
      updatedBy: stringOrNull(row.updated_by),
    }));
  }

  async saveSettings(
    name: string,
    settings: Record<string, unknown>,
    updatedBy: string,
  ): Promise<void> {
    await this.db.execute(
      sql`insert into integration_settings(name,settings,updated_by) values(${name},${JSON.stringify(settings)}::jsonb,${updatedBy})
        on conflict(name) do update set settings=excluded.settings,updated_by=excluded.updated_by,updated_at=now()`,
    );
  }
}
