import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { RuntimeEnv } from "../src/config/env.js";
import { createWorkers } from "../src/composition/demo-pipeline.js";
import { CoachingAiGateway } from "../src/infrastructure/ai/coaching-ai-gateway.js";
import { ProcessDemoParser } from "../src/infrastructure/parser/demo-parser.js";
import { PgPrivacyRepository } from "../src/modules/privacy/privacy.repository.js";
import {
  startWorkers,
  type WorkerHandle,
} from "../src/workers/worker-scheduler.js";
import { demoBytes, LENIENT_UPLOAD_RATE } from "./support/demo-bytes.js";
import { TestDatabase } from "./support/test-database.js";
import { testDatabaseUrl } from "./support/database-url.js";

const databaseUrl = testDatabaseUrl();
const fixture = process.env.DEMO_FIXTURE;
const parserBin = process.env.DEMO_PARSER_BIN;

/**
 * The demo pipeline against Postgres, the real parser and the public fixture: events in object
 * storage behind the analysis reader, checksum dedupe (immediate and in the worker, one parse for
 * simultaneous uploads), automatic re-parse after a parser upgrade and the events migration.
 */
describe.skipIf(!databaseUrl || !fixture || !parserBin)(
  "demo pipeline: events storage, dedupe, parser-upgrade reprocess (Postgres)",
  () => {
    let admin: Pool;
    let repo: TestDatabase;
    let app: FastifyInstance;
    let directory: string;
    let worker: WorkerHandle;
    let worker2: WorkerHandle;
    let parses = 0;
    let payload: Buffer;
    const schema = "pipeline_" + randomUUID().replaceAll("-", "");
    const alice = { authorization: "Bearer alice-token" };
    const bob = { authorization: "Bearer bob-token" };

    beforeAll(async () => {
      admin = new Pool({ connectionString: databaseUrl });
      await admin.query(`create schema ${schema}`);
      const url = new URL(databaseUrl!);
      url.searchParams.set("options", `-c search_path=${schema}`);
      repo = new TestDatabase(url.toString());
      await repo.migrate();
      await repo.seedDev("alice", "alice-token", "alice-device", "ad-token");
      await repo.seedDev("bob", "bob-token", "bob-device", "bd-token");
      await repo.seedDev("admin", "admin-token", "admin-device", "xd-token");
      await repo.pool.query("update users set role='admin' where id='admin'");
      directory = await mkdtemp(resolve(tmpdir(), "cs2-pipeline-"));
      repo.storageDir = directory;
      payload = await readFile(fixture!);
      const options = {
        storageDir: directory,
        parserBin: parserBin!,
        disableWorker: true,
      };
      app = await buildApp({
        database: repo,
        devices: [],
        owners: [],
        webOrigin: "http://127.0.0.1:3000",
        jobs: options,
        overrides: { uploadRate: LENIENT_UPLOAD_RATE },
      });
      const real = new ProcessDemoParser(parserBin!);
      const makeWorker = () => {
        const workers = createWorkers(
          repo.db,
          options,
          new RuntimeEnv(),
          new PgPrivacyRepository(repo.db),
          new CoachingAiGateway(),
          {
            demoParser: {
              parse: (demo, replay) => {
                parses++;
                return real.parse(demo, replay);
              },
              version: () => real.version(),
            },
          },
        );
        return startWorkers(
          workers.demos,
          workers.retention,
          options,
          undefined,
          workers.maintenance,
        );
      };
      worker = await makeWorker();
      // A second worker process (scale-out) for the concurrency test.
      worker2 = await makeWorker();
    });
    beforeEach(async () => {
      await repo.pool.query("delete from uploads");
      await repo.pool.query("select delete_unreferenced_matches()");
      await repo.pool.query("delete from file_deletions");
      await repo.pool.query("delete from usage_counters");
      for (const owner of ["alice", "bob"]) {
        await repo.pool.query(
          "insert into subscriptions(owner_id,plan_id,status,source) values($1,'pro','active','admin') on conflict(owner_id) do update set plan_id='pro',status='active',current_period_end=null",
          [owner],
        );
        await repo.updateSettings(owner, {
          telemetryConsent: true,
          analyticsConsent: false,
          retentionDays: 30,
        });
      }
      for (const file of await readdir(directory))
        await rm(resolve(directory, file), { force: true });
      parses = 0;
    });
    afterAll(async () => {
      await worker?.stop();
      await worker2?.stop();
      await app?.close();
      await repo?.close();
      if (directory) await rm(directory, { recursive: true, force: true });
      if (admin) {
        await admin.query(`drop schema ${schema} cascade`);
        await admin.end();
      }
    });

    const upload = (headers: Record<string, string>, body = payload) =>
      app.inject({
        method: "POST",
        url: "/v1/demos/uploads",
        headers: {
          ...headers,
          "content-type": "application/octet-stream",
          "x-filename": "public-cs2.dem",
        },
        payload: body,
      });
    /** Upload + job + match state of an upload (status as the API reports it). */
    const row = async (id: string) =>
      (
        await repo.pool.query(
          "select x.id,x.owner_id,x.match_id,case when x.match_id is not null and (j.kind<>'reparse' or j.status='done') then 'complete' when j.status='processing' then 'processing' when j.status='failed' then 'failed' else 'queued' end as status,j.kind,j.status as job_status,m.parser_version,m.events_count,m.summary from uploads x left join demo_jobs j on j.upload_id=x.id left join matches m on m.id=x.match_id where x.id=$1",
          [id],
        )
      ).rows[0];
    const matchCount = async () =>
      (await repo.pool.query("select count(*)::int as n from matches")).rows[0]
        .n as number;
    const exists = (name: string) =>
      stat(resolve(directory, name)).then(
        () => true,
        () => false,
      );
    async function parsedBy(headers: Record<string, string>) {
      const { id } = (await upload(headers)).json();
      await worker.maintenance();
      await worker.runOnce();
      return id as string;
    }

    it("stores the analysis and events per match in object storage and every reader gets the full analysis", async () => {
      const id = await parsedBy(alice);
      const stored = await row(id);
      expect(stored.status).toBe("complete");
      // Postgres keeps a slim summary only (no players, evidence or events).
      expect(stored.summary.events).toBeUndefined();
      expect(stored.summary.players).toBeUndefined();
      expect(stored.summary.roundOutcomes.length).toBeGreaterThan(0);
      expect(stored.events_count).toBeGreaterThan(1000);
      expect(stored.parser_version).toMatch(/cs2live\./);
      for (const suffix of [".analysis", ".events", ".replay"])
        expect(await exists(`${stored.match_id}${suffix}.json.gz`)).toBe(true);
      const players = await repo.pool.query(
        "select steam_id,adr,kills,rounds_played,team_start from match_players where match_id=$1",
        [stored.match_id],
      );
      expect(players.rows).toHaveLength(10);
      expect(players.rows.every((p) => p.rounds_played > 0)).toBe(true);
      const match = (
        await repo.pool.query(
          "select map,rounds_count,score_ct,score_t,played_at_source from matches where id=$1",
          [stored.match_id],
        )
      ).rows[0];
      expect(match.rounds_count).toBe(stored.summary.roundOutcomes.length);
      expect(match.played_at_source).toBe("upload");
      const view = (
        await app.inject({ url: `/v1/analyses/${id}`, headers: alice })
      ).json();
      expect(Object.keys(view)).toEqual(["id", "analysis", "coaching"]);
      expect(view.analysis.events).toHaveLength(stored.events_count);
      expect(view.analysis.players.length).toBe(10);
      expect(view.analysis.map).toBe(match.map);
      const meta = await app.inject({
        url: `/v1/analyses/${id}/replay/meta`,
        headers: alice,
      });
      expect(meta.statusCode).toBe(200);
      const round = await app.inject({
        url: `/v1/analyses/${id}/replay?round=2`,
        headers: alice,
      });
      expect(round.statusCode).toBe(200);
      expect(
        round.json().events.filter((e: { type: string }) => e.type === "kill")
          .length,
      ).toBeGreaterThan(0);
    }, 60_000);

    it("dedupes by checksum: another account's upload points at the same match (no copy), reference counted", async () => {
      const first = await parsedBy(alice);
      expect(parses).toBe(1);
      const response = await upload(bob);
      expect(response.statusCode).toBe(202);
      const second = response.json().id as string;
      // Completed by the API before any worker run: no second parse, no copied files.
      const copy = await row(second);
      const original = await row(first);
      expect(copy.status).toBe("complete");
      expect(copy.owner_id).toBe("bob");
      expect(copy.match_id).toBe(original.match_id);
      expect(await matchCount()).toBe(1);
      expect(parses).toBe(1);
      const view = (
        await app.inject({ url: `/v1/analyses/${second}`, headers: bob })
      ).json();
      expect(view.analysis.events).toHaveLength(copy.events_count);
      // Alice's upload stays private to Alice.
      expect(
        (await app.inject({ url: `/v1/analyses/${first}`, headers: bob }))
          .statusCode,
      ).toBe(404);
      // Deleting Alice's account removes Alice's demo; the shared match survives for Bob.
      expect(
        (
          await app.inject({
            method: "DELETE",
            url: "/v1/account",
            headers: alice,
          })
        ).statusCode,
      ).toBeLessThan(300);
      await worker.cleanup();
      expect(await exists(`${first}.dem`)).toBe(false);
      expect(await matchCount()).toBe(1);
      for (const suffix of [".analysis", ".events", ".replay"])
        expect(await exists(`${copy.match_id}${suffix}.json.gz`)).toBe(true);
      const after = (
        await app.inject({ url: `/v1/analyses/${second}`, headers: bob })
      ).json();
      expect(after.analysis.events).toHaveLength(copy.events_count);
      expect(
        (
          await app.inject({
            url: `/v1/analyses/${second}/replay/meta`,
            headers: bob,
          })
        ).statusCode,
      ).toBe(200);
      // The last upload going away (retention) deletes the match and its files.
      await repo.pool.query(
        "update uploads set created_at=now()-interval '40 days' where id=$1",
        [second],
      );
      await worker.cleanup();
      expect(await matchCount()).toBe(0);
      for (const suffix of [".analysis", ".events", ".replay"])
        expect(await exists(`${copy.match_id}${suffix}.json.gz`)).toBe(false);
      expect(await exists(`${second}.dem`)).toBe(false);
      await repo.seedDev("alice", "alice-token", "alice-device", "ad-token");
    }, 60_000);

    it("parses once when two accounts upload the same new demo simultaneously", async () => {
      await worker.maintenance();
      const [a, b] = await Promise.all([upload(alice), upload(bob)]);
      expect([a.statusCode, b.statusCode]).toEqual([202, 202]);
      // Both workers poll at the same time: one claims and parses, the other finds the same
      // checksum in progress and claims nothing; afterwards the other upload dedupes.
      await Promise.all([worker.runOnce(), worker2.runOnce()]);
      await worker2.runOnce();
      const rows = [await row(a.json().id), await row(b.json().id)];
      expect(rows.map((r) => r.status)).toEqual(["complete", "complete"]);
      expect(parses).toBe(1);
      expect(rows[0].match_id).toBe(rows[1].match_id);
      expect(await matchCount()).toBe(1);
    }, 60_000);

    it("re-parses analyses of an older parser in the background, behind fresh uploads", async () => {
      const id = await parsedBy(alice);
      const old = (await row(id)).match_id as string;
      await repo.pool.query(
        "update matches set parser_version='demoinfocs-golang/v5@v5.0.0+cs2live.1' where id=$1",
        [old],
      );
      const status = () =>
        app.inject({
          url: "/v1/admin/analyses/reprocess/status",
          headers: { authorization: "Bearer admin-token" },
        });
      expect(
        (
          await app.inject({
            url: "/v1/admin/analyses/reprocess/status",
            headers: alice,
          })
        ).statusCode,
      ).toBe(403);
      await worker.maintenance();
      await worker.maintenance(); // idempotent
      expect(await row(id)).toMatchObject({
        kind: "reprocess",
        job_status: "queued",
      });
      const before = (await status()).json();
      expect(before).toMatchObject({ pending: 1, done: 0, failed: 0 });
      expect(before.currentVersion).toMatch(/cs2live\./);
      // A fresh upload is claimed before the background re-parse.
      const fresh = (await upload(bob, demoBytes("not parseable"))).json().id;
      await worker.runOnce();
      expect((await row(fresh)).status).toBe("failed");
      expect((await row(id)).job_status).toBe("queued");
      // The analysis stays visible while queued.
      expect((await row(id)).status).toBe("complete");
      expect(
        (await app.inject({ url: `/v1/analyses/${id}`, headers: alice }))
          .statusCode,
      ).toBe(200);
      await worker.runOnce();
      const done = await row(id);
      expect(done.status).toBe("complete");
      expect(done.job_status).toBe("done");
      expect(done.parser_version).toBe(before.currentVersion);
      // The upload moved to the new parse; the old match was unreferenced and deleted.
      expect(done.match_id).not.toBe(old);
      expect(await matchCount()).toBe(1);
      await worker.cleanup();
      expect(await exists(`${old}.analysis.json.gz`)).toBe(false);
      expect((await status()).json()).toMatchObject({
        pending: 0,
        done: 1,
        failed: 0,
      });
      // First parse, the failed fresh upload, the background re-parse.
      expect(parses).toBe(3);
    }, 60_000);
  },
);
