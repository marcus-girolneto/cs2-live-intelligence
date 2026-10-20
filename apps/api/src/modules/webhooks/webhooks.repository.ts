import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";
import {
  isoDate,
  isoOrNull,
  uuidOrNull,
  type Row,
} from "../../shared/db/rows.js";
import {
  DISABLE_AFTER_FAILURES,
  type DeliveryDto,
  type DeliveryEvent,
  type WebhookDto,
  type WebhookEvent,
} from "./webhooks.dto.js";

/** A claimed delivery with what is needed to sign and send it. */
export type DueDelivery = {
  id: string;
  webhookId: string;
  ownerId: string;
  event: DeliveryEvent;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  url: string;
  secretCiphertext: string;
};
export type AttemptOutcome = {
  ok: boolean;
  status: number | null;
  error: string | null;
  /** Next retry, or null when this was the last attempt. */
  retryAt: Date | null;
  /** Pings (test deliveries) do not count toward auto-disabling. */
  countFailure: boolean;
};

export interface WebhooksRepository {
  list(ownerId: string): Promise<WebhookDto[]>;
  /** undefined when the owner already has `max` webhooks. */
  create(
    ownerId: string,
    webhook: {
      id: string;
      url: string;
      events: WebhookEvent[];
      secretCiphertext: string;
    },
    max: number,
  ): Promise<WebhookDto | undefined>;
  remove(ownerId: string, id: string): Promise<boolean>;
  find(
    ownerId: string,
    id: string,
  ): Promise<(WebhookDto & { secretCiphertext: string }) | undefined>;
  deliveries(
    ownerId: string,
    webhookId: string | undefined,
    limit: number,
  ): Promise<DeliveryDto[]>;
  /** Turns new demo/review outcomes into pending deliveries (idempotent); returns how many. */
  enqueueEvents(): Promise<number>;
  /** Leases up to `limit` due deliveries (attempts + 1, invisible for 2 minutes). */
  claimDue(limit: number): Promise<DueDelivery[]>;
  /** A ping delivery for the test button, leased to the caller. */
  createPing(webhookId: string, ownerId: string): Promise<DueDelivery>;
  recordAttempt(delivery: DueDelivery, outcome: AttemptOutcome): Promise<void>;
  /** Drops deliveries older than 30 days. */
  purge(): Promise<void>;
}

const WEBHOOK_COLUMNS = sql.raw(
  `id,url,events,active,consecutive_failures,disabled_reason,created_at`,
);
export function webhookView(row: Row): WebhookDto {
  return {
    id: row.id as string,
    url: row.url as string,
    events: row.events as WebhookEvent[],
    active: row.active === true,
    consecutiveFailures: Number(row.consecutive_failures ?? 0),
    disabledReason: (row.disabled_reason as string | null) ?? null,
    createdAt: isoDate(row.created_at),
  };
}
function deliveryView(row: Row): DeliveryDto {
  return {
    id: row.id as string,
    webhookId: row.webhook_id as string,
    event: row.event as DeliveryEvent,
    status: row.status as DeliveryDto["status"],
    attempts: Number(row.attempts),
    lastStatus: (row.last_status as number | null) ?? null,
    lastError: (row.last_error as string | null) ?? null,
    nextAttemptAt:
      row.status === "pending" ? isoOrNull(row.next_attempt_at) : null,
    createdAt: isoDate(row.created_at),
    deliveredAt: isoOrNull(row.delivered_at),
  };
}
function dueView(row: Row): DueDelivery {
  return {
    id: row.id as string,
    webhookId: row.webhook_id as string,
    ownerId: row.owner_id as string,
    event: row.event as DeliveryEvent,
    payload: row.payload as Record<string, unknown>,
    createdAt: isoDate(row.created_at),
    attempts: Number(row.attempts),
    url: row.url as string,
    secretCiphertext: row.secret_ciphertext as string,
  };
}
const textArray = (values: readonly string[]): string =>
  `{${values.map((v) => `"${v.replace(/["\\]/g, "")}"`).join(",")}}`;
/** Events newer than the webhook itself and at most a day old. */
const SINCE = sql.raw(`greatest(w.created_at, now()-interval '1 day')`);

export class PgWebhooksRepository implements WebhooksRepository {
  constructor(private readonly db: Db) {}

  async list(ownerId: string): Promise<WebhookDto[]> {
    const r = await this.db.execute(
      sql`select ${WEBHOOK_COLUMNS} from webhooks where owner_id=${ownerId} order by created_at desc`,
    );
    return r.rows.map(webhookView);
  }

  create(
    ownerId: string,
    webhook: {
      id: string;
      url: string;
      events: WebhookEvent[];
      secretCiphertext: string;
    },
    max: number,
  ): Promise<WebhookDto | undefined> {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select id from users where id=${ownerId} for update`,
      );
      const count = await tx.execute(
        sql`select count(*)::int as n from webhooks where owner_id=${ownerId}`,
      );
      if (Number(count.rows[0]?.n ?? 0) >= max) return undefined;
      const r = await tx.execute(
        sql`insert into webhooks(id,owner_id,url,events,secret_ciphertext) values(${webhook.id},${ownerId},${webhook.url},${textArray(webhook.events)}::text[],${webhook.secretCiphertext}) returning ${WEBHOOK_COLUMNS}`,
      );
      return webhookView(r.rows[0]!);
    });
  }

  async remove(ownerId: string, id: string): Promise<boolean> {
    const r = await this.db.execute(
      sql`delete from webhooks where id=${uuidOrNull(id)} and owner_id=${ownerId} returning id`,
    );
    return r.rows.length > 0;
  }

  async find(
    ownerId: string,
    id: string,
  ): Promise<(WebhookDto & { secretCiphertext: string }) | undefined> {
    const r = await this.db.execute(
      sql`select ${WEBHOOK_COLUMNS},secret_ciphertext from webhooks where id=${uuidOrNull(id)} and owner_id=${ownerId}`,
    );
    const row = r.rows[0];
    return row
      ? {
          ...webhookView(row),
          secretCiphertext: row.secret_ciphertext as string,
        }
      : undefined;
  }

  async deliveries(
    ownerId: string,
    webhookId: string | undefined,
    limit: number,
  ): Promise<DeliveryDto[]> {
    const filter = webhookId
      ? sql` and webhook_id=${uuidOrNull(webhookId)}`
      : sql``;
    const r = await this.db.execute(
      sql`select id,webhook_id,event,status,attempts,last_status,last_error,next_attempt_at,created_at,delivered_at from webhook_deliveries where owner_id=${ownerId}${filter} order by created_at desc limit ${limit}`,
    );
    return r.rows.map(deliveryView);
  }

  async enqueueEvents(): Promise<number> {
    const statements = [
      sql`insert into webhook_deliveries(id,webhook_id,owner_id,event,ref,payload)
        select gen_random_uuid(),w.id,w.owner_id,'demo.completed',u.id::text,
          jsonb_build_object('demoId',u.id,'filename',u.filename,'status','complete','map',m.map)
        from webhooks w join uploads u on u.owner_id=w.owner_id join matches m on m.id=u.match_id
        left join demo_jobs j on j.upload_id=u.id
        where w.active and 'demo.completed'=any(w.events) and u.completed_at>${SINCE}
          and (j.upload_id is null or j.kind<>'reparse' or j.status='done')
        on conflict (webhook_id,event,ref) do nothing`,
      sql`insert into webhook_deliveries(id,webhook_id,owner_id,event,ref,payload)
        select gen_random_uuid(),w.id,w.owner_id,'demo.failed',u.id::text,
          jsonb_build_object('demoId',u.id,'filename',u.filename,'status','failed','error',j.error)
        from webhooks w join uploads u on u.owner_id=w.owner_id join demo_jobs j on j.upload_id=u.id
        where w.active and 'demo.failed'=any(w.events) and j.status='failed' and u.match_id is null
          and j.updated_at>${SINCE}
        on conflict (webhook_id,event,ref) do nothing`,
      sql`insert into webhook_deliveries(id,webhook_id,owner_id,event,ref,payload)
        select gen_random_uuid(),w.id,w.owner_id,'review.completed',r.id::text,
          jsonb_build_object('reviewId',r.id,'demoId',r.upload_id,'steamId',r.steam_id,'tier',r.kind)
        from webhooks w join ai_reviews r on r.owner_id=w.owner_id
        where w.active and 'review.completed'=any(w.events) and r.created_at>${SINCE}
        on conflict (webhook_id,event,ref) do nothing`,
    ];
    let total = 0;
    for (const statement of statements)
      total += (await this.db.execute(statement)).rowCount ?? 0;
    return total;
  }

  async claimDue(limit: number): Promise<DueDelivery[]> {
    const r = await this.db.execute(
      sql`with due as (
          select d.id from webhook_deliveries d join webhooks w on w.id=d.webhook_id
          where d.status='pending' and d.next_attempt_at<=now() and w.active
          order by d.next_attempt_at limit ${limit} for update of d skip locked)
        update webhook_deliveries d set attempts=d.attempts+1,next_attempt_at=now()+interval '2 minutes'
        from due, webhooks w where d.id=due.id and w.id=d.webhook_id
        returning d.id,d.webhook_id,d.owner_id,d.event,d.payload,d.created_at,d.attempts,w.url,w.secret_ciphertext`,
    );
    return r.rows.map(dueView);
  }

  async createPing(webhookId: string, ownerId: string): Promise<DueDelivery> {
    const id = randomUUID();
    const r = await this.db.execute(
      sql`with d as (insert into webhook_deliveries(id,webhook_id,owner_id,event,ref,payload,attempts,next_attempt_at)
          values(${id},${webhookId},${ownerId},'ping',${id},${JSON.stringify({ message: "Test delivery from FragMind" })}::jsonb,1,now()+interval '2 minutes')
          returning *)
        select d.id,d.webhook_id,d.owner_id,d.event,d.payload,d.created_at,d.attempts,w.url,w.secret_ciphertext
        from d join webhooks w on w.id=d.webhook_id`,
    );
    return dueView(r.rows[0]!);
  }

  recordAttempt(delivery: DueDelivery, outcome: AttemptOutcome): Promise<void> {
    return this.db.transaction(async (tx) => {
      if (outcome.ok) {
        await tx.execute(
          sql`update webhook_deliveries set status='delivered',delivered_at=now(),last_status=${outcome.status},last_error=null where id=${delivery.id}`,
        );
        await tx.execute(
          sql`update webhooks set consecutive_failures=0,updated_at=now() where id=${delivery.webhookId}`,
        );
        return;
      }
      const retryAt = outcome.retryAt?.toISOString() ?? null;
      await tx.execute(
        sql`update webhook_deliveries set status=${retryAt ? "pending" : "failed"},next_attempt_at=coalesce(${retryAt}::timestamptz,now()),last_status=${outcome.status},last_error=${outcome.error?.slice(0, 300) ?? null} where id=${delivery.id}`,
      );
      if (!outcome.countFailure) return;
      const r = await tx.execute(
        sql`update webhooks set consecutive_failures=consecutive_failures+1,updated_at=now(),
            active=active and consecutive_failures+1<${DISABLE_AFTER_FAILURES},
            disabled_reason=case when consecutive_failures+1>=${DISABLE_AFTER_FAILURES} then 'Disabled after repeated failed deliveries' else disabled_reason end
          where id=${delivery.webhookId} returning active`,
      );
      if (r.rows[0] && r.rows[0].active === false)
        await tx.execute(
          sql`update webhook_deliveries set status='failed',last_error=coalesce(last_error,'Webhook disabled') where webhook_id=${delivery.webhookId} and status='pending'`,
        );
    });
  }

  async purge(): Promise<void> {
    await this.db.execute(
      sql`delete from webhook_deliveries where created_at<now()-interval '30 days'`,
    );
  }
}
