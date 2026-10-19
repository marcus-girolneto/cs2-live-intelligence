import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";
import type { EventProperties } from "./feedback.dto.js";

const FEEDBACK_PER_DAY = 20;
const EVENTS_PER_DAY = 1000;

/** Consent-gated, daily-capped product feedback and analytics events. */
export interface FeedbackRepository {
  /** undefined without analytics consent or over the daily cap. */
  feedback(
    ownerId: string,
    rating: number,
    comment?: string,
  ): Promise<{ id: string } | undefined>;
  /** false without analytics consent or over the daily cap. */
  productEvent(
    ownerId: string,
    name: string,
    properties: EventProperties,
  ): Promise<boolean>;
}

export class PgFeedbackRepository implements FeedbackRepository {
  constructor(private readonly db: Db) {}

  feedback(
    ownerId: string,
    rating: number,
    comment?: string,
  ): Promise<{ id: string } | undefined> {
    return this.db.transaction(async (tx) => {
      const account = await tx.execute(
        sql`select analytics_consent from users where id=${ownerId} for update`,
      );
      if (!account.rows[0]?.analytics_consent) return undefined;
      const quota = await tx.execute(
        sql`select count(*) as total from feedback where owner_id=${ownerId} and created_at>now()-interval '24 hours'`,
      );
      if (Number(quota.rows[0]!.total) >= FEEDBACK_PER_DAY) return undefined;
      const id = randomUUID();
      await tx.execute(
        sql`insert into feedback(id,owner_id,rating,comment) values(${id},${ownerId},${rating},${comment ?? null})`,
      );
      return { id };
    });
  }

  productEvent(
    ownerId: string,
    name: string,
    properties: EventProperties,
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const r = await tx.execute(
        sql`select analytics_consent from users where id=${ownerId} for update`,
      );
      if (!r.rows[0]?.analytics_consent) return false;
      const count = await tx.execute(
        sql`select count(*) as total from product_events where owner_id=${ownerId} and created_at>now()-interval '24 hours'`,
      );
      if (Number(count.rows[0]!.total) >= EVENTS_PER_DAY) return false;
      await tx.execute(
        sql`insert into product_events(id,owner_id,name,properties) values(${randomUUID()},${ownerId},${name},${JSON.stringify(properties)}::jsonb)`,
      );
      return true;
    });
  }
}
