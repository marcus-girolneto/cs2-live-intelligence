import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { PgMaintenanceRepository } from "../src/modules/maintenance/maintenance.repository.js";
import { DATA_RETENTION_DEFAULTS } from "../src/modules/ai-config/ai-config.dto.js";
import { silentLogger } from "../src/shared/logging/logger.js";
import { DataRetentionJob } from "../src/workers/data-retention.job.js";
import { testDatabaseUrl } from "./support/database-url.js";
import { TestDatabase } from "./support/test-database.js";

const databaseUrl = testDatabaseUrl();

describe.skipIf(!databaseUrl)("database schema (Postgres)", () => {
  let admin: Pool;
  let repo: TestDatabase;
  let app: FastifyInstance;
  let directory: string;
  const schema = "schema_" + randomUUID().replaceAll("-", "");
  const headers = { authorization: "Bearer owner-token" };

  beforeAll(async () => {
    admin = new Pool({ connectionString: databaseUrl });
    await admin.query(`create schema ${schema}`);
    const url = new URL(databaseUrl!);
    url.searchParams.set("options", `-c search_path=${schema}`);
    repo = new TestDatabase(url.toString());
    await repo.migrate();
    // Applying the migrations again is a no-op.
    await repo.migrate();
    await repo.seedDev("owner", "owner-token", "device", "device-token");
    directory = await mkdtemp(resolve(tmpdir(), "cs2-schema-"));
    repo.storageDir = directory;
    app = await buildApp({
      database: repo,
      devices: [],
      owners: [],
      webOrigin: "http://127.0.0.1:3000",
      jobs: { storageDir: directory, parserBin: "unused", disableWorker: true },
    });
  });
  afterAll(async () => {
    await app?.close();
    await repo?.close();
    if (directory) await rm(directory, { recursive: true, force: true });
    if (admin) {
      await admin.query(`drop schema ${schema} cascade`);
      await admin.end();
    }
  });

  it("indexes every foreign-key column (as the leading columns of an index)", async () => {
    const r = await repo.pool.query(
      `select c.conrelid::regclass::text as tbl, c.conname,
         array_agg(a.attname::text order by k.ord) as cols
       from pg_constraint c
       join pg_class t on t.oid = c.conrelid
       join pg_namespace n on n.oid = t.relnamespace
       cross join lateral unnest(c.conkey) with ordinality k(attnum, ord)
       join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
       where c.contype = 'f' and n.nspname = current_schema()
         and c.conparentid = 0 and not t.relispartition
         and not exists (
           select 1 from pg_index i
           where i.indrelid = c.conrelid
             and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] @> c.conkey
             and c.conkey @> (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1]
         )
       group by 1, 2 order by 1, 2`,
    );
    expect(r.rows).toEqual([]);
    const fks = await repo.pool.query(
      "select count(*)::int as n from pg_constraint c join pg_namespace n on n.oid=c.connamespace where c.contype='f' and n.nspname=current_schema() and c.conparentid=0",
    );
    expect(fks.rows[0].n).toBeGreaterThan(30);
  });

  it("stores generated ids as uuid (users.id stays text for the development identity)", async () => {
    const r = await repo.pool.query(
      "select table_name||'.'||column_name as col,data_type from information_schema.columns where table_schema=current_schema() and column_name in ('id','upload_id','match_id','provider_id','review_id') and table_name !~ '_p[0-9]{6}$'",
    );
    const types = Object.fromEntries(r.rows.map((x) => [x.col, x.data_type]));
    for (const col of [
      "uploads.id",
      "matches.id",
      "match_players.match_id",
      "demo_jobs.upload_id",
      "ai_reviews.id",
      "ai_reviews.upload_id",
      "auto_reviews.upload_id",
      "auto_reviews.review_id",
      "match_bans.match_id",
      "credit_ledger.id",
      "credit_holds.id",
      "reports.id",
      "personal_coach_plans.id",
      "ai_providers.id",
      "ai_assignments.provider_id",
      "admin_audit.id",
      "product_events.id",
    ])
      expect([col, types[col]]).toEqual([col, "uuid"]);
    expect(types["users.id"]).toBe("text");
    for (const old of ["coach_reviews", "team_reviews", "match_ownership"]) {
      const exists = await repo.pool.query("select to_regclass($1) as t", [
        old,
      ]);
      expect(exists.rows[0].t).toBeNull();
    }
  });

  it("answers 404 (not 500) for ids that are not UUIDs", async () => {
    for (const url of [
      "/v1/matches/not-a-uuid",
      "/v1/analyses/not-a-uuid",
      "/v1/reports/not-a-uuid",
    ]) {
      const r = await app.inject({ url, headers });
      expect([url, r.statusCode]).toEqual([url, 404]);
    }
    const rate = await app.inject({
      method: "POST",
      url: "/v1/coach/reviews/not-a-uuid/rating",
      headers,
      payload: { rating: 5 },
    });
    expect(rate.statusCode).toBe(404);
    const auto = await app.inject({
      url: "/v1/matches/auto-reviews?ids=x,y",
      headers,
    });
    expect(auto.json()).toEqual({ items: [] });
  });

  it("partitions telemetry and product events by month and applies global retention in batches", async () => {
    const partitions = async (table: string) =>
      (
        await repo.pool.query(
          "select c.relname from pg_inherits i join pg_class c on c.oid=i.inhrelid where i.inhparent=to_regclass($1) order by 1",
          [table],
        )
      ).rows.map((r) => r.relname as string);
    const now = new Date();
    const month = (offset: number) => {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1),
      );
      return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    };
    // Created by the migration: this month and the next two.
    for (const table of ["telemetry_events", "product_events"])
      expect(await partitions(table)).toEqual(
        expect.arrayContaining([0, 1, 2].map((m) => `${table}_p${month(m)}`)),
      );
    // An old month partition with expired rows, plus expired rows in the current month.
    await repo.pool.query(
      "create table telemetry_events_p200001 partition of telemetry_events for values from ('2000-01-01') to ('2000-02-01')",
    );
    await repo.pool.query(
      "insert into telemetry_events(device_id,event_id,owner_id,created_at) values('device','old','owner','2000-01-15'),('device','new','owner',now())",
    );
    // product_events keeps 180 days: the row of 200 days ago needs its month partition.
    const old = new Date(Date.now() - 200 * 86_400_000);
    const from = new Date(Date.UTC(old.getUTCFullYear(), old.getUTCMonth(), 1));
    const to = new Date(
      Date.UTC(old.getUTCFullYear(), old.getUTCMonth() + 1, 1),
    );
    await repo.pool.query(
      `create table if not exists product_events_old partition of product_events for values from ('${from.toISOString()}') to ('${to.toISOString()}')`,
    );
    await repo.pool.query(
      "insert into product_events(id,owner_id,name,properties,created_at) values($1,'owner','old','{}',now()-interval '200 days'),($2,'owner','new','{}',now())",
      [randomUUID(), randomUUID()],
    );
    await repo.pool.query(
      "insert into admin_audit(id,admin_id,action,created_at) values($1,'owner','old',now()-interval '400 days'),($2,'owner','new',now())",
      [randomUUID(), randomUUID()],
    );
    await repo.pool.query(
      "insert into usage_counters(owner_id,day,kind,count) values('owner',current_date-100,'upload',1),('owner',current_date,'upload',1)",
    );
    await repo.pool.query(
      "insert into provider_usage(owner_id,day,requests) values('owner',current_date-100,1)",
    );
    await repo.pool.query(
      "insert into file_deletions(object_key,processed_at) values('a.dem',now()-interval '10 days'),('b.dem',now()),('c.dem',null)",
    );
    const job = new DataRetentionJob(
      new PgMaintenanceRepository(repo.db),
      { retention: async () => DATA_RETENTION_DEFAULTS },
      silentLogger,
    );
    await job.run();
    expect(await partitions("telemetry_events")).not.toContain(
      "telemetry_events_p200001",
    );
    const names = async (sql: string) =>
      (await repo.pool.query(sql)).rows.map((r) => Object.values(r)[0]);
    expect(await names("select event_id from telemetry_events")).toEqual([
      "new",
    ]);
    expect(await names("select name from product_events")).toEqual(["new"]);
    expect(await names("select action from admin_audit")).toEqual(["new"]);
    expect(await names("select count(*)::int from usage_counters")).toEqual([
      1,
    ]);
    expect(await names("select count(*)::int from provider_usage")).toEqual([
      0,
    ]);
    expect(
      await names("select object_key from file_deletions order by 1"),
    ).toEqual(["b.dem", "c.dem"]);
    // Idempotent: a second run changes nothing.
    await job.run();
    expect(await names("select event_id from telemetry_events")).toEqual([
      "new",
    ]);
  });

  it("deduplicates collector events per device across partitions", async () => {
    await repo.pool.query("delete from telemetry_events");
    const ingest = () =>
      repo.pool.query(
        "insert into telemetry_events(device_id,event_id,owner_id) select 'device','dup','owner' where not exists(select 1 from telemetry_events where device_id='device' and event_id='dup') returning event_id",
      );
    expect((await ingest()).rows).toHaveLength(1);
    expect((await ingest()).rows).toHaveLength(0);
  });
});
