import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Pool } from "pg";
import type { FastifyInstance } from "fastify";
import { TestDatabase } from "./support/test-database.js";
import { buildApp } from "../src/app.js";
import { createWorker } from "../src/container.js";
import { syntheticAnalysis, syntheticReplay } from "./replay-fixtures.js";

const databaseUrl = process.env.DATABASE_URL;
describe.skipIf(!databaseUrl)("replay artifacts and endpoints", () => {
  let admin: Pool;
  let repo: TestDatabase;
  let app: FastifyInstance;
  let directory: string;
  let worker: Awaited<ReturnType<typeof createWorker>>;
  const schema = "replay_" + randomUUID().replaceAll("-", "");
  const headers = { authorization: "Bearer owner-token" };
  const other = { authorization: "Bearer other-owner" };
  beforeAll(async () => {
    admin = new Pool({ connectionString: databaseUrl });
    await admin.query(`create schema ${schema}`);
    const url = new URL(databaseUrl!);
    url.searchParams.set("options", `-c search_path=${schema}`);
    repo = new TestDatabase(url.toString());
    await repo.migrate();
    await repo.seedDev("owner", "owner-token", "device", "device-token");
    await repo.seedDev("other", "other-owner", "other-device", "other-token");
    directory = await mkdtemp(resolve(tmpdir(), "cs2-replay-"));
    const options = {
      storageDir: directory,
      parserBin: process.env.DEMO_PARSER_BIN ?? process.execPath,
      disableWorker: true,
    };
    app = await buildApp({
      database: repo,
      devices: [],
      owners: [],
      webOrigin: "http://127.0.0.1:3000",
      jobs: options,
    });
    worker = await createWorker(repo, options);
  });
  beforeEach(async () => {
    await repo.pool.query("delete from demo_jobs");
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
  /** Stores a demo object and queues its job directly (plan upload quotas are tested elsewhere). */
  async function queue(payload: Buffer, filename = "match.dem") {
    const id = randomUUID();
    await writeFile(resolve(directory, `${id}.dem`), payload);
    await repo.createJob("owner", {
      id,
      filename,
      objectKey: `${id}.dem`,
      checksum: createHash("sha256").update(payload).digest("hex"),
      size: payload.length,
    });
    return id;
  }
  /** A completed job with a synthetic analysis and replay artifact on disk. */
  async function syntheticJob(withReplay = true) {
    const id = await queue(Buffer.from("synthetic"));
    const job = await repo.claimJob();
    await repo.finishJob(id, job!.leaseToken, {
      analysis: syntheticAnalysis,
      coaching: {},
    });
    if (withReplay)
      await writeFile(
        resolve(directory, `${id}.replay.json.gz`),
        gzipSync(JSON.stringify(syntheticReplay())),
      );
    return id as string;
  }

  it("serves meta and windows only to the owner, with validation", async () => {
    const id = await syntheticJob();
    const meta = await app.inject({
      url: `/v1/analyses/${id}/replay/meta`,
      headers,
    });
    expect(meta.statusCode).toBe(200);
    expect(meta.json()).toMatchObject({
      map: "de_test",
      rounds: [{ number: 1, ct: ["b"], t: ["a"] }],
      outline: [
        [24, 24],
        [72, 24],
      ],
    });
    const window = await app.inject({
      url: `/v1/analyses/${id}/replay?round=1&from=45&to=100`,
      headers,
    });
    expect(window.statusCode).toBe(200);
    expect(window.json()).toMatchObject({ round: 1, from: 45, to: 60 });
    expect(window.json().events.map((e: { type: string }) => e.type)).toEqual(
      expect.arrayContaining(["kill", "damage", "shot"]),
    );
    for (const [url, auth, status] of [
      [`/v1/analyses/${id}/replay/meta`, {}, 401],
      [`/v1/analyses/${id}/replay?round=1`, {}, 401],
      [`/v1/analyses/${id}/replay/meta`, other, 404],
      [`/v1/analyses/${id}/replay?round=1`, other, 404],
      [`/v1/analyses/not-a-uuid/replay/meta`, headers, 400],
      [`/v1/analyses/${randomUUID()}/replay/meta`, headers, 404],
      [`/v1/analyses/${id}/replay`, headers, 400],
      [`/v1/analyses/${id}/replay?round=0`, headers, 400],
      [`/v1/analyses/${id}/replay?round=1&from=9&to=3`, headers, 400],
      [`/v1/analyses/${id}/replay?round=1&from=-2`, headers, 400],
      [`/v1/analyses/${id}/replay?round=1&evil=1`, headers, 400],
      [`/v1/analyses/${id}/replay?round=7`, headers, 404],
    ] as const) {
      const r = await app.inject({ url, headers: auth });
      expect([url, r.statusCode]).toEqual([url, status]);
      expect(r.json().error).toBeTruthy();
    }
    const bad = await app.inject({
      url: `/v1/analyses/${id}/replay?round=0`,
      headers,
    });
    expect(bad.json().code).toBe("invalid_request");
  });

  it("reports a missing replay as 404 for analyses processed before replays", async () => {
    const id = await syntheticJob(false);
    const r = await app.inject({
      url: `/v1/analyses/${id}/replay/meta`,
      headers,
    });
    expect(r.statusCode).toBe(404);
    expect(r.json().error).toBe("Replay not available");
    await writeFile(resolve(directory, `${id}.replay.json.gz`), "not gzip");
    expect(
      (await app.inject({ url: `/v1/analyses/${id}/replay/meta`, headers }))
        .statusCode,
    ).toBe(404);
  });

  it("deletes replays with account deletion, retention and stray cleanup", async () => {
    const kept = await syntheticJob();
    const expired = await syntheticJob();
    await repo.pool.query(
      "update demo_jobs set created_at=now()-interval '8 days' where id=$1",
      [expired],
    );
    const stray = `${randomUUID()}.replay.json.gz`;
    const strayTmp = ".replay-123.tmp";
    for (const name of [stray, strayTmp]) {
      await writeFile(resolve(directory, name), "x");
      const old = new Date(Date.now() - 2 * 3600000);
      await utimes(resolve(directory, name), old, old);
    }
    await worker.cleanup();
    const files = await readdir(directory);
    expect(files).toContain(`${kept}.replay.json.gz`);
    expect(files).not.toContain(`${expired}.replay.json.gz`);
    expect(files).not.toContain(stray);
    expect(files).not.toContain(strayTmp);
    expect(
      (await app.inject({ method: "DELETE", url: "/v1/account", headers }))
        .statusCode,
    ).toBe(204);
    await worker.cleanup();
    expect(await readdir(directory)).toHaveLength(0);
    await repo.seedDev("owner", "owner-token", "device", "device-token");
  });

  it.skipIf(!process.env.DEMO_FIXTURE || !process.env.DEMO_PARSER_BIN)(
    "generates a replay when processing the real CS2 fixture",
    async () => {
      const id = await queue(
        await readFile(process.env.DEMO_FIXTURE!),
        "public-cs2.dem",
      );
      await worker.runOnce();
      expect((await repo.match("owner", id))?.status).toBe("complete");
      const size = (await stat(resolve(directory, `${id}.replay.json.gz`)))
        .size;
      expect(size).toBeGreaterThan(50_000);
      expect(size).toBeLessThan(600_000);
      const meta = (
        await app.inject({ url: `/v1/analyses/${id}/replay/meta`, headers })
      ).json();
      expect(meta).toMatchObject({
        map: "de_mirage",
        tickRate: 64,
        sampleHz: 8,
      });
      expect(meta.rounds).toHaveLength(9);
      expect(meta.players).toHaveLength(10);
      expect(meta.outline.length).toBeGreaterThan(1000);
      const round = meta.rounds.find((r: { number: number }) => r.number === 3);
      expect(round.ct).toHaveLength(5);
      expect(round.t).toHaveLength(5);
      // A full round in two windows of at most 40 s.
      const frames: { t: number }[] = [];
      const events: { type: string; id?: string }[] = [];
      for (let from = 0; from < round.duration + 3; from += 40) {
        const w = await app.inject({
          url: `/v1/analyses/${id}/replay?round=3&from=${from}&to=${from + 40}`,
          headers,
        });
        expect(w.statusCode).toBe(200);
        frames.push(...w.json().frames);
        events.push(...w.json().events);
      }
      expect(frames.length).toBeGreaterThan(8 * round.duration);
      const kills = events.filter((e) => e.type === "kill");
      expect(kills.length).toBeGreaterThan(0);
      expect(kills.every((k) => k.id?.startsWith("ev_"))).toBe(true);
      expect(events.some((e) => e.type === "shot")).toBe(true);
      expect(events.some((e) => e.type === "grenade")).toBe(true);
      // Reprocessing replaces the artifact.
      await repo.requeueJobs([id]);
      await worker.runOnce();
      expect((await repo.match("owner", id))?.status).toBe("complete");
      expect(
        (await stat(resolve(directory, `${id}.replay.json.gz`))).size,
      ).toBe(size);
      if (process.env.REPLAY_EXAMPLES_DIR) {
        const dir = process.env.REPLAY_EXAMPLES_DIR;
        await writeFile(
          resolve(dir, "replay-meta.json"),
          JSON.stringify(meta, null, 1),
        );
        const full = await app.inject({
          url: `/v1/analyses/${id}/replay?round=3&from=0&to=40`,
          headers,
        });
        const rest = await app.inject({
          url: `/v1/analyses/${id}/replay?round=3&from=40&to=80`,
          headers,
        });
        const a = full.json();
        const b = rest.json();
        await writeFile(
          resolve(dir, "replay-round3.json"),
          JSON.stringify({
            ...a,
            to: b.to,
            note: "Round 3 merged from two API windows (0-40 s and 40-80 s); the API serves at most 40 s per request.",
            frames: [
              ...a.frames,
              ...b.frames.filter((f: { t: number }) => f.t > a.to),
            ],
            events: [
              ...a.events,
              ...b.events.filter((e: { t: number }) => e.t > a.to),
            ],
          }),
        );
      }
    },
    120000,
  );
});
