import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { mkdtemp, rm, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Pool } from "pg";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import type { FastifyInstance } from "fastify";
import { PgRepository } from "../src/repository.js";
import { buildApp } from "../src/app.js";
import { createWorker, objectPath } from "../src/jobs.js";
const databaseUrl = process.env.DATABASE_URL;
describe.skipIf(!databaseUrl)(
  "durable demo upload, jobs, consent and retention",
  () => {
    let admin: Pool;
    let repo: PgRepository;
    let app: FastifyInstance;
    let directory: string;
    let testDatabaseUrl: string;
    let worker: Awaited<ReturnType<typeof createWorker>>;
    const schema = "jobs_" + randomUUID().replaceAll("-", "");
    const headers = { authorization: "Bearer owner-token" };
    beforeAll(async () => {
      admin = new Pool({ connectionString: databaseUrl });
      await admin.query(`create schema ${schema}`);
      const url = new URL(databaseUrl!);
      url.searchParams.set("options", `-c search_path=${schema}`);
      testDatabaseUrl = url.toString();
      repo = new PgRepository(testDatabaseUrl);
      await repo.migrate();
      await repo.seedDev("owner", "owner-token", "device", "device-token");
      await repo.seedDev("other", "other-owner", "other-device", "other-token");
      directory = await mkdtemp(resolve(tmpdir(), "cs2-jobs-"));
      const options = {
        storageDir: directory,
        parserBin: process.env.DEMO_PARSER_BIN ?? process.execPath,
        disableWorker: true,
      };
      app = await buildApp({
        repository: repo,
        devices: [],
        owners: [],
        webOrigin: "http://127.0.0.1:3000",
        jobs: options,
      });
      worker = await createWorker(repo, options);
    });
    beforeEach(async () => {
      await repo.pool.query("delete from demo_jobs");
      await repo.pool.query("delete from product_events");
      await repo.pool.query("delete from feedback");
      await repo.pool.query("delete from provider_usage");
      await repo.updateSettings("owner", {
        telemetryConsent: true,
        analyticsConsent: false,
        retentionDays: 7,
      });
      for (const file of await readdir(directory))
        await rm(resolve(directory, file), { force: true });
    });
    afterAll(async () => {
      await worker?.stop();
      await app?.close();
      await repo?.close();
      if (directory) await rm(directory, { recursive: true, force: true });
      if (admin) {
        await admin.query(`drop schema ${schema} cascade`);
        await admin.end();
      }
    });
    function upload(payload: Buffer, filename = "sample.dem", auth = headers) {
      return app.inject({
        method: "POST",
        url: "/v1/demos/uploads",
        headers: {
          ...auth,
          "content-type": "application/octet-stream",
          "x-filename": filename,
        },
        payload,
      });
    }
    it("authenticates before streaming, validates filename/size and stores checksum with generated private key", async () => {
      expect(
        (
          await upload(Buffer.from("payload"), "sample.dem", {
            authorization: "Bearer bad",
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (await upload(Buffer.from("payload"), "../escape.dem")).statusCode,
      ).toBe(400);
      expect((await upload(Buffer.alloc(0))).statusCode).toBe(400);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/v1/demos/uploads",
            headers: {
              ...headers,
              "content-type": "application/octet-stream",
              "x-filename": "sample.dem",
              "content-length": String(128 * 1024 * 1024),
            },
            payload: Buffer.from("bad"),
          })
        ).statusCode,
      ).toBe(413);
      const response = await upload(Buffer.from("payload"));
      expect(response.statusCode).toBe(202);
      const { id } = response.json();
      const stored = (
        await repo.pool.query("select * from demo_jobs where id=$1", [id])
      ).rows[0];
      expect(stored.checksum).toBe(
        createHash("sha256").update("payload").digest("hex"),
      );
      expect(stored.filename).toBe("sample.dem");
      expect(stored.object_key).toBe(id + ".dem");
      expect(
        await readFile(objectPath(directory, stored.object_key), "utf8"),
      ).toBe("payload");
      expect(
        (await app.inject({ url: "/v1/matches", headers })).json().matches[0],
      ).toMatchObject({ id, status: "queued", filename: "sample.dem" });
      expect(
        (await app.inject({ url: "/v1/devices", headers })).statusCode,
      ).toBe(200);
      expect(
        (
          await app.inject({
            url: "/v1/matches/" + id,
            headers: { authorization: "Bearer other-owner" },
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (
          await app.inject({
            url: "/v1/analyses/" + id,
            headers: { authorization: "Bearer other-owner" },
          })
        ).statusCode,
      ).toBe(404);
    });
    it("releases upload concurrency after clients abort partial streams", async () => {
      if (!app.server.listening)
        await app.listen({ host: "127.0.0.1", port: 0 });
      const address = app.server.address() as AddressInfo;
      for (let i = 0; i < 5; i++)
        await new Promise<void>((resolveAbort) => {
          const request = httpRequest({
            hostname: "127.0.0.1",
            port: address.port,
            path: "/v1/demos/uploads",
            method: "POST",
            headers: {
              ...headers,
              "content-type": "application/octet-stream",
              "x-filename": "partial.dem",
              "content-length": "100000",
            },
          });
          request.on("error", () => resolveAbort());
          request.write(Buffer.alloc(100));
          setTimeout(() => request.destroy(), 20);
        });
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
      expect((await upload(Buffer.from("valid after abort"))).statusCode).toBe(
        202,
      );
      expect((await repo.matches("owner")).matches).toHaveLength(1);
      expect(await readdir(directory)).toHaveLength(1);
    });
    it("claims jobs only once across workers and rejects expired stale completion", async () => {
      const { id } = (await upload(Buffer.from("corrupt"))).json();
      const [first, second] = await Promise.all([
        repo.claimJob(),
        repo.claimJob(),
      ]);
      const claimed = first ?? second;
      expect(claimed?.id).toBe(id);
      expect([first, second].filter(Boolean)).toHaveLength(1);
      await repo.pool.query(
        "update demo_jobs set lease_until=now()-interval '1 second' where id=$1",
        [id],
      );
      const next = await repo.claimJob();
      expect(next?.leaseToken).not.toBe(claimed?.leaseToken);
      await repo.finishJob(id, claimed!.leaseToken, { error: "old worker" });
      expect((await repo.match("owner", id))?.status).toBe("processing");
      await repo.pool.query(
        "update demo_jobs set lease_until=now()-interval '1 second' where id=$1",
        [id],
      );
      expect(await repo.claimJob()).toBeUndefined();
      expect((await repo.match("owner", id))?.status).toBe("failed");
    });
    it("fails corrupt input without invented analysis and keeps error bounded", async () => {
      const { id } = (await upload(Buffer.from("corrupt demo"))).json();
      await worker.runOnce();
      const match = await repo.match("owner", id);
      expect(match?.status).toBe("failed");
      expect(match?.error).toMatch(/^Demo parser/);
      expect(await repo.analysis("owner", id)).toBeUndefined();
    });
    it("enforces owner active quota and consent withdrawal cancels queued processing", async () => {
      expect((await upload(Buffer.from("one"))).statusCode).toBe(202);
      expect((await upload(Buffer.from("two"))).statusCode).toBe(202);
      expect((await upload(Buffer.from("three"))).statusCode).toBe(429);
      expect(await readdir(directory)).toHaveLength(2);
      await repo.updateSettings("owner", {
        telemetryConsent: false,
        analyticsConsent: false,
        retentionDays: 7,
      });
      expect(await repo.claimJob()).toBeUndefined();
      expect((await upload(Buffer.from("four"))).statusCode).toBe(403);
      expect(
        (await repo.matches("owner")).matches.every(
          (m) => m.status === "failed",
        ),
      ).toBe(true);
    });
    it("enforces feedback/product consent and daily provider reservations", async () => {
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/v1/feedback",
            headers,
            payload: { rating: 5 },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/v1/events",
            headers,
            payload: { name: "upload_opened" },
          })
        ).statusCode,
      ).toBe(403);
      await repo.updateSettings("owner", {
        telemetryConsent: true,
        analyticsConsent: true,
        retentionDays: 7,
      });
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/v1/feedback",
            headers,
            payload: { rating: 5, comment: "Helpful" },
          })
        ).statusCode,
      ).toBe(201);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/v1/events",
            headers,
            payload: {
              name: "upload_opened",
              properties: { source: "history" },
            },
          })
        ).statusCode,
      ).toBe(202);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/v1/events",
            headers,
            payload: {
              name: "upload_opened",
              properties: { nested: { not: "scalar" } },
            },
          })
        ).statusCode,
      ).toBe(400);
      expect(await repo.reserveProvider("owner")).toBe(true);
      expect(await repo.reserveProvider("owner")).toBe(true);
      expect(await repo.reserveProvider("owner")).toBe(true);
      expect(await repo.reserveProvider("owner")).toBe(false);
    });
    it("retention durably removes metadata and filesystem objects", async () => {
      const { id } = (await upload(Buffer.from("expired"))).json();
      await repo.pool.query(
        "update demo_jobs set created_at=now()-interval '8 days' where id=$1",
        [id],
      );
      await worker.cleanup();
      expect(await repo.match("owner", id)).toBeUndefined();
      expect(await readdir(directory)).toHaveLength(0);
      expect(await repo.pendingDeletions()).toHaveLength(0);
    });
    it.skipIf(!process.env.DEMO_FIXTURE || !process.env.DEMO_PARSER_BIN)(
      "processes a provenance-documented actual CS2 demo into metrics and offline coaching",
      async () => {
        const payload = await readFile(process.env.DEMO_FIXTURE!);
        const response = await upload(payload, "public-cs2.dem");
        expect(response.statusCode).toBe(202);
        const { id } = response.json();
        await worker.runOnce();
        const match = await repo.match("owner", id);
        expect(match?.status).toBe("complete");
        const result = await repo.analysis("owner", id);
        expect(result?.analysis).toMatchObject({
          schemaVersion: "1.0",
          source: "demo",
        });
        expect(result?.coaching).toMatchObject({
          schemaVersion: "1.0",
          mode: "offline",
        });
        const http = await app.inject({ url: "/v1/analyses/" + id, headers });
        expect(http.statusCode).toBe(200);
        expect(http.json().analysis.players.length).toBeGreaterThan(0);
      },
      30000,
    );
    it("waits for active worker before closing its PostgreSQL pool", async () => {
      const isolated = new PgRepository(testDatabaseUrl);
      let release!: (value: undefined) => void;
      const pending = new Promise<undefined>((resolvePending) => {
        release = resolvePending;
      });
      vi.spyOn(isolated, "claimJob").mockImplementation(() => pending);
      const server = await buildApp({
        repository: isolated,
        closeRepositoryOnClose: true,
        devices: [],
        owners: [],
        webOrigin: "http://127.0.0.1:3000",
        jobs: {
          storageDir: directory,
          parserBin: process.execPath,
          workerIntervalMs: 5,
        },
      });
      await server.ready();
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 20));
      let closed = false;
      const closing = server.close().then(() => {
        closed = true;
      });
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 20));
      expect(closed).toBe(false);
      await isolated.ready();
      release(undefined);
      await closing;
      await expect(isolated.ready()).rejects.toThrow();
    });
    it("account deletion queues file removal and revokes all credentials immediately", async () => {
      const { id } = (await upload(Buffer.from("delete me"))).json();
      expect(
        (await app.inject({ method: "DELETE", url: "/v1/account", headers }))
          .statusCode,
      ).toBe(204);
      expect(await repo.owner("owner-token")).toBeUndefined();
      expect(await repo.match("owner", id)).toBeUndefined();
      expect(await repo.pendingDeletions()).toContain(id + ".dem");
      await worker.cleanup();
      expect(await readdir(directory)).toHaveLength(0);
    });
  },
);
