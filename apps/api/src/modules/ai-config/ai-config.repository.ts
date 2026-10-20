import { sql } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";
import { isoDate, stringOrNull, uuidOrNull } from "../../shared/db/rows.js";
import {
  assignmentOptionsSchema,
  type AiPurpose,
  type AssignmentMap,
  type AssignmentOptions,
} from "./ai-config.dto.js";

/** A stored provider profile; secrets are AES-GCM ciphertexts. */
export interface AiProviderRecord {
  id: string;
  name: string;
  provider: string;
  baseUrl: string | null;
  apiKeyEnc: string | null;
  keyLast4: string | null;
  headersEnc: string | null;
  headerNames: string[];
  options: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
export type AssignmentChanges = Partial<
  Record<
    AiPurpose,
    ({ providerId: string; model: string } & AssignmentOptions) | null
  >
>;

/** The stored options of an assignment (only the known keys). */
export const assignmentOptions = (
  value: AssignmentOptions,
): AssignmentOptions => ({
  ...(value.maxOutputTokens !== undefined
    ? { maxOutputTokens: value.maxOutputTokens }
    : {}),
  ...(value.reasoningEffort !== undefined
    ? { reasoningEffort: value.reasoningEffort }
    : {}),
});

export interface AiConfigRepository {
  providers(): Promise<AiProviderRecord[]>;
  saveProvider(
    row: Omit<AiProviderRecord, "createdAt" | "updatedAt">,
  ): Promise<void>;
  /** in_use while the provider is assigned to a purpose. */
  deleteProvider(id: string): Promise<"ok" | "not_found" | "in_use">;
  assignments(): Promise<AssignmentMap>;
  setAssignments(changes: AssignmentChanges): Promise<void>;
  appSettings(): Promise<{
    settings: Record<string, unknown>;
    updatedAt: string | null;
  }>;
  saveAppSettings(settings: Record<string, unknown>): Promise<void>;
}
/** Global per-account daily AI request cap (provider_usage). */
export interface AiUsageRepository {
  /** Consumes one request when below `limit` (and the account consents); false otherwise. */
  reserveDailyRequest(ownerId: string, limit: number): Promise<boolean>;
}

export class PgAiConfigRepository
  implements AiConfigRepository, AiUsageRepository
{
  constructor(private readonly db: Db) {}

  async providers(): Promise<AiProviderRecord[]> {
    const r = await this.db.execute(
      sql`select id,name,provider,base_url,api_key_enc,key_last4,headers_enc,header_names,options,created_at,updated_at from ai_providers order by created_at`,
    );
    return r.rows.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      provider: row.provider as string,
      baseUrl: stringOrNull(row.base_url),
      apiKeyEnc: stringOrNull(row.api_key_enc),
      keyLast4: stringOrNull(row.key_last4),
      headersEnc: stringOrNull(row.headers_enc),
      headerNames: (row.header_names as string[]) ?? [],
      options: (row.options as Record<string, unknown>) ?? {},
      createdAt: isoDate(row.created_at),
      updatedAt: isoDate(row.updated_at),
    }));
  }

  async saveProvider(
    row: Omit<AiProviderRecord, "createdAt" | "updatedAt">,
  ): Promise<void> {
    await this.db.execute(
      sql`insert into ai_providers(id,name,provider,base_url,api_key_enc,key_last4,headers_enc,header_names,options) values(${row.id},${row.name},${row.provider},${row.baseUrl},${row.apiKeyEnc},${row.keyLast4},${row.headersEnc},${JSON.stringify(row.headerNames)}::jsonb,${JSON.stringify(row.options)}::jsonb)
        on conflict(id) do update set name=excluded.name,provider=excluded.provider,base_url=excluded.base_url,api_key_enc=excluded.api_key_enc,key_last4=excluded.key_last4,headers_enc=excluded.headers_enc,header_names=excluded.header_names,options=excluded.options,updated_at=now()`,
    );
  }

  deleteProvider(raw: string): Promise<"ok" | "not_found" | "in_use"> {
    const id = uuidOrNull(raw);
    return this.db.transaction(async (tx) => {
      const used = await tx.execute(
        sql`select purpose from ai_assignments where provider_id=${id}`,
      );
      if (used.rows.length) return "in_use";
      const r = await tx.execute(
        sql`delete from ai_providers where id=${id} returning id`,
      );
      return r.rows.length ? "ok" : "not_found";
    });
  }

  async assignments(): Promise<AssignmentMap> {
    const r = await this.db.execute(
      sql`select purpose,provider_id,model,options,updated_at from ai_assignments`,
    );
    const out: AssignmentMap = {};
    for (const row of r.rows) {
      const options = assignmentOptionsSchema.safeParse(row.options ?? {});
      out[row.purpose as AiPurpose] = {
        providerId: row.provider_id as string,
        model: row.model as string,
        ...(options.success ? options.data : {}),
        updatedAt: isoDate(row.updated_at),
      };
    }
    return out;
  }

  async setAssignments(changes: AssignmentChanges): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const [purpose, value] of Object.entries(changes)) {
        if (value === undefined) continue;
        if (value === null)
          await tx.execute(
            sql`delete from ai_assignments where purpose=${purpose}`,
          );
        else
          await tx.execute(
            sql`insert into ai_assignments(purpose,provider_id,model,options) values(${purpose},${value.providerId},${value.model},${JSON.stringify(assignmentOptions(value))}::jsonb) on conflict(purpose) do update set provider_id=excluded.provider_id,model=excluded.model,options=excluded.options,updated_at=now()`,
          );
      }
    });
  }

  async appSettings(): Promise<{
    settings: Record<string, unknown>;
    updatedAt: string | null;
  }> {
    const r = await this.db.execute(
      sql`select settings,updated_at from app_settings where id`,
    );
    const row = r.rows[0];
    return row
      ? {
          settings: (row.settings as Record<string, unknown>) ?? {},
          updatedAt: isoDate(row.updated_at),
        }
      : { settings: {}, updatedAt: null };
  }

  async saveAppSettings(settings: Record<string, unknown>): Promise<void> {
    await this.db.execute(
      sql`insert into app_settings(id,settings) values(true,${JSON.stringify(settings)}::jsonb) on conflict(id) do update set settings=excluded.settings,updated_at=now()`,
    );
  }

  async reserveDailyRequest(ownerId: string, limit: number): Promise<boolean> {
    const r = await this.db.execute(
      sql`insert into provider_usage(owner_id,day,requests) select ${ownerId},CURRENT_DATE,1 from users where id=${ownerId} and telemetry_consent and ${limit} > 0 on conflict(owner_id,day) do update set requests=provider_usage.requests+1 where provider_usage.requests<${limit} returning requests`,
    );
    return r.rows.length > 0;
  }
}
