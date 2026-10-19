import { sql } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";

/** Webhook idempotency store. */
export interface BillingRepository {
  /** True when the event id was already processed. */
  seen(eventId: string): Promise<boolean>;
  /** Records a processed event; false when another delivery recorded it first. */
  record(eventId: string, type: string): Promise<boolean>;
}

export class PgBillingRepository implements BillingRepository {
  constructor(private readonly db: Db) {}
  async seen(eventId: string): Promise<boolean> {
    const r = await this.db.execute(
      sql`select 1 from billing_events where id=${eventId}`,
    );
    return r.rows.length > 0;
  }
  async record(eventId: string, type: string): Promise<boolean> {
    const r = await this.db.execute(
      sql`insert into billing_events(id,type) values(${eventId},${type}) on conflict(id) do nothing returning id`,
    );
    return r.rows.length > 0;
  }
}
