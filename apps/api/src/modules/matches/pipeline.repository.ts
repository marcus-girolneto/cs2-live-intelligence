import { sql } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";
import { uuidsOnly } from "../../shared/db/rows.js";

/** Bookkeeping of the demo pipeline: parser version, dedupe and parser-upgrade reprocessing. */
export interface PipelineRepository {
  /** The parser version the worker runs (undefined before the first worker start). */
  parserVersion(): Promise<string | undefined>;
  setParserVersion(version: string): Promise<void>;
  /**
   * Dedupe: points the upload at the existing match of the same demo bytes parsed by `version`
   * (no copy). Only a queued job, or a processing job still leased with `leaseToken`, of an
   * owner who still consents. Returns the match id, or undefined when nothing was linked.
   */
  linkExisting(
    uploadId: string,
    version: string,
    leaseToken?: string,
  ): Promise<string | undefined>;
  /** Complete uploads whose match was parsed by another version (demo not deleted). */
  outdated(
    version: string,
    limit: number,
  ): Promise<{ id: string; objectKey: string }[]>;
  /** Queues background re-parses (idempotent: only finished, not already queued jobs). */
  queueReprocess(ids: string[]): Promise<number>;
  reprocessStatus(version: string): Promise<{
    pending: number;
    done: number;
    failed: number;
  }>;
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

  linkExisting(
    uploadId: string,
    version: string,
    leaseToken?: string,
  ): Promise<string | undefined> {
    return this.db.transaction(async (tx) => {
      const found = await tx.execute(
        sql`select m.id,m.checksum from uploads u join matches m on m.checksum=u.checksum and m.parser_version=${version} join users o on o.id=u.owner_id where u.id=${uploadId} and o.telemetry_consent and (u.match_id is null or u.match_id<>m.id)`,
      );
      const match = found.rows[0];
      if (!match) return undefined;
      const job = await tx.execute(
        sql`update demo_jobs set status='done',error=null,lease_until=null,lease_token=null,updated_at=now() where upload_id=${uploadId} and kind<>'reparse' and (status='queued' or (status='processing' and lease_token=${leaseToken ?? null})) returning kind`,
      );
      if (!job.rows.length) return undefined;
      await tx.execute(
        sql`update uploads set match_id=${match.id},completed_at=coalesce(case when ${job.rows[0]!.kind}='reprocess' then completed_at end,now()) where id=${uploadId}`,
      );
      await tx.execute(
        sql`select delete_unreferenced_matches(${match.checksum as string})`,
      );
      return match.id as string;
    });
  }

  async outdated(
    version: string,
    limit: number,
  ): Promise<{ id: string; objectKey: string }[]> {
    const r = await this.db.execute(
      sql`select u.id,u.object_key from uploads u join matches m on m.id=u.match_id join demo_jobs j on j.upload_id=u.id where j.status='done' and m.parser_version is distinct from ${version} and not exists(select 1 from file_deletions f where f.object_key=u.object_key) order by u.created_at desc limit ${limit}`,
    );
    return r.rows.map((row) => ({
      id: row.id as string,
      objectKey: row.object_key as string,
    }));
  }

  async queueReprocess(ids: string[]): Promise<number> {
    const valid = uuidsOnly(ids);
    if (!valid.length) return 0;
    const r = await this.db.execute(
      sql`update demo_jobs j set kind='reprocess',status='queued',attempts=0,error=null,updated_at=now() from uploads u where u.id=j.upload_id and u.match_id is not null and j.upload_id in (select jsonb_array_elements_text(${JSON.stringify(valid)}::jsonb)::uuid) and j.status='done' returning j.upload_id`,
    );
    return r.rows.length;
  }

  async reprocessStatus(
    version: string,
  ): Promise<{ pending: number; done: number; failed: number }> {
    const r = await this.db.execute(
      sql`select count(*) filter(where m.parser_version=${version})::int as done,count(*) filter(where j.kind='reprocess' and j.status='failed')::int as failed,count(*) filter(where m.parser_version is distinct from ${version} and not (j.kind='reprocess' and j.status='failed') and not exists(select 1 from file_deletions f where f.object_key=u.object_key))::int as pending from uploads u join matches m on m.id=u.match_id join demo_jobs j on j.upload_id=u.id where j.kind<>'reparse' or j.status='done'`,
    );
    const row = r.rows[0] ?? {};
    return {
      pending: Number(row.pending ?? 0),
      done: Number(row.done ?? 0),
      failed: Number(row.failed ?? 0),
    };
  }
}
