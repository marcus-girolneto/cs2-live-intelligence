import { sql } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";
import {
  creditSettingsSchema,
  DEFAULT_CREDIT_SETTINGS,
  type CreditSettings,
  type PackInput,
  type PackRecord,
} from "./credits.dto.js";

/** Admin-editable credit settings (single row) and the credit pack catalogue. */
export interface CreditSettingsRepository {
  settings(): Promise<CreditSettings>;
  saveSettings(settings: CreditSettings): Promise<void>;
  packs(): Promise<PackRecord[]>;
  savePacks(packs: PackInput[]): Promise<void>;
}

const prices = (v: unknown): PackRecord["prices"] => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const out: PackRecord["prices"] = {};
  for (const c of ["BRL", "USD"] as const)
    if (typeof o[c] === "number" && Number.isInteger(o[c]) && o[c] >= 0)
      out[c] = o[c] as number;
  return out;
};

export class PgCreditSettingsRepository implements CreditSettingsRepository {
  constructor(private readonly db: Db) {}

  async settings(): Promise<CreditSettings> {
    const r = await this.db.execute(
      sql`select settings from credit_settings where id`,
    );
    const stored = creditSettingsSchema
      .partial()
      .safeParse(r.rows[0]?.settings ?? {});
    return {
      ...DEFAULT_CREDIT_SETTINGS,
      ...(stored.success ? stored.data : {}),
    };
  }

  async saveSettings(settings: CreditSettings): Promise<void> {
    await this.db.execute(
      sql`insert into credit_settings(id,settings) values(true,${JSON.stringify(settings)}::jsonb) on conflict(id) do update set settings=excluded.settings,updated_at=now()`,
    );
  }

  async packs(): Promise<PackRecord[]> {
    const r = await this.db.execute(
      sql`select id,name,credits,prices,stripe_prices,badge,active,sort from credit_packs order by sort,id`,
    );
    return r.rows.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      credits: Number(row.credits),
      prices: prices(row.prices),
      stripePrices: (row.stripe_prices ?? {}) as PackRecord["stripePrices"],
      badge: (row.badge as string | null) ?? null,
      active: row.active === true,
      sort: Number(row.sort),
    }));
  }

  async savePacks(packs: PackInput[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const p of packs)
        await tx.execute(
          sql`insert into credit_packs(id,name,credits,prices,stripe_prices,badge,active,sort) values(${p.id},${p.name},${p.credits},${JSON.stringify(p.prices)}::jsonb,${JSON.stringify(p.stripePrices ?? {})}::jsonb,${p.badge ?? null},${p.active},${p.sort})
            on conflict(id) do update set name=excluded.name,credits=excluded.credits,prices=excluded.prices,stripe_prices=excluded.stripe_prices,badge=excluded.badge,active=excluded.active,sort=excluded.sort,updated_at=now()`,
        );
    });
  }
}
