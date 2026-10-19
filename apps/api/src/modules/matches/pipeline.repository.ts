import { sql } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";

/** Storage and bookkeeping of the demo pipeline: parser version, dedupe, reprocess, events. */
export interface PipelineRepository {
  /** The parser version the worker runs (undefined before the first worker start). */
  parserVersion(): Promise<string | undefined>;
  setParserVersion(version: string): Promise<void>;
  /** A complete job with the same checksum analysed by `version` (not `excludeId`). */
  donor(
    checksum: string,
    version: string,
    excludeId: string,
  ): Promise<{ id: string; eventsCount: number | null } | undefined>;
  /**
   * Completes `jobId` with a copy of the donor's analysis and coaching. Only a queued job, or a
   * processing job still leased with `leaseToken`, of an owner who still consents.
   */
  completeClone(
    jobId: string,
    donorId: string,
    leaseToken?: string,
  ): Promise<boolean>;
  /** Complete jobs analysed by another parser version, not yet queued, source not deleted. */
  outdated(
    version: string,
    limit: number,
  ): Promise<{ id: string; objectKey: string }[]>;
  /** Queues background re-parses (idempotent: only jobs not already queued). */
  queueReprocess(ids: string[]): Promise<number>;
  reprocessStatus(version: string): Promise<{
    pending: number;
    done: number;
    failed: number;
  }>;
  /** Complete jobs whose analysis still holds its `events` inline (oldest first). */
  inlineEvents(limit: number): Promise<{ id: string; events: unknown[] }[]>;
  /** Drops the inline events once stored, only if the row still holds `count` of them. */
  eventsMoved(id: string, count: number): Promise<boolean>;
  inlineEventsLeft(): Promise<number>;
}

export class PgPipelineRepository implements PipelineRepository {
  constructor(private readonly db: Db) {}

  async parserVersion(): Promise<string | undefined> {
    const r = await this.db.execute(
      sql`select version from parser_runtime where id=1`,
    );
    return (r.rows[0]?.version as string | undefined) ?? undefined;
  }

  async setParserVersion(version: string): Promise<void> {
    await this.db.execute(
      sql`insert into parser_runtime(id,version) values(1,${version}) on conflict(id) do update set version=excluded.version,updated_at=now()`,
    );
  }

  async donor(
    checksum: string,
    version: string,
    excludeId: string,
  ): Promise<{ id: string; eventsCount: number | null } | undefined> {
    const r = await this.db.execute(
      sql`select id,events_count from demo_jobs where checksum=${checksum} and status='complete' and parser_version=${version} and id<>${excludeId} and reprocess_state is distinct from 'processing' and analysis is not null order by updated_at desc limit 1`,
    );
    const row = r.rows[0];
    return row
      ? {
          id: row.id as string,
          eventsCount: (row.events_count as number | null) ?? null,
        }
      : undefined;
  }

  async completeClone(
    jobId: string,
    donorId: string,
    leaseToken?: string,
  ): Promise<boolean> {
    const r = await this.db.execute(
      sql`update demo_jobs t set status='complete',analysis=d.analysis,coaching=d.coaching,parser_version=d.parser_version,events_count=d.events_count,deduped_from=d.id,error=null,lease_until=null,lease_token=null,updated_at=now() from demo_jobs d where t.id=${jobId} and d.id=${donorId} and d.status='complete' and d.analysis is not null and (t.status='queued' or (t.status='processing' and t.lease_token=${leaseToken ?? null})) and exists(select 1 from users where id=t.owner_id and telemetry_consent)`,
    );
    return (r.rowCount ?? 0) > 0;
  }

  async outdated(
    version: string,
    limit: number,
  ): Promise<{ id: string; objectKey: string }[]> {
    const r = await this.db.execute(
      sql`select j.id,j.object_key from demo_jobs j where j.status='complete' and j.parser_version is distinct from ${version} and j.reprocess_state is null and not exists(select 1 from file_deletions f where f.object_key=j.object_key) order by j.created_at desc limit ${limit}`,
    );
    return r.rows.map((row) => ({
      id: row.id as string,
      objectKey: row.object_key as string,
    }));
  }

  async queueReprocess(ids: string[]): Promise<number> {
    if (!ids.length) return 0;
    const r = await this.db.execute(
      sql`update demo_jobs set reprocess_state='queued',reprocess_attempts=0,reprocess_error=null where id in (select jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)) and status='complete' and reprocess_state is null returning id`,
    );
    return r.rows.length;
  }

  async reprocessStatus(
    version: string,
  ): Promise<{ pending: number; done: number; failed: number }> {
    const r = await this.db.execute(
      sql`select count(*) filter(where j.parser_version=${version})::int as done,count(*) filter(where j.reprocess_state='failed')::int as failed,count(*) filter(where j.parser_version is distinct from ${version} and j.reprocess_state is distinct from 'failed' and not exists(select 1 from file_deletions f where f.object_key=j.object_key))::int as pending from demo_jobs j where j.status='complete'`,
    );
    const row = r.rows[0] ?? {};
    return {
      pending: Number(row.pending ?? 0),
      done: Number(row.done ?? 0),
      failed: Number(row.failed ?? 0),
    };
  }

  async inlineEvents(
    limit: number,
  ): Promise<{ id: string; events: unknown[] }[]> {
    const r = await this.db.execute(
      sql`select id,analysis->'events' as events from demo_jobs where status='complete' and analysis ? 'events' order by created_at limit ${limit}`,
    );
    return r.rows.map((row) => ({
      id: row.id as string,
      events: Array.isArray(row.events) ? (row.events as unknown[]) : [],
    }));
  }

  async eventsMoved(id: string, count: number): Promise<boolean> {
    const r = await this.db.execute(
      sql`update demo_jobs set analysis=analysis-'events',events_count=${count} where id=${id} and analysis ? 'events' and jsonb_array_length(case when jsonb_typeof(analysis->'events')='array' then analysis->'events' else '[]'::jsonb end)=${count}`,
    );
    return (r.rowCount ?? 0) > 0;
  }

  async inlineEventsLeft(): Promise<number> {
    const r = await this.db.execute(
      sql`select count(*)::int as n from demo_jobs where status='complete' and analysis ? 'events'`,
    );
    return Number(r.rows[0]?.n ?? 0);
  }
}
