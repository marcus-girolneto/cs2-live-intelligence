import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Pool } from "pg";
import type { FastifyInstance } from "fastify";
import { trainingPlanSchema, catalogEntrySchema } from "@cs2/contracts";
import { TestDatabase } from "./support/test-database.js";
import { buildApp } from "../src/app.js";
import { testDatabaseUrl } from "./support/database-url.js";

const metric = (value: number) => ({
  value,
  numerator: value,
  denominator: 1,
  complete: true,
  formula: "x",
  evidenceIds: [],
});
const player = (steamId: string) => ({
  steamId,
  kills: metric(1),
  deaths: metric(2),
  adr: metric(70),
  headshotPercentage: metric(40),
  rounds: [1, 2].map((round) => ({
    round,
    side: "CT",
    won: false,
    died: true,
    kills: 0,
    damage: 0,
    headshots: 0,
    traded: false,
    damageAssist: false,
  })),
});
const death = (id: string, round: number) => ({
  id,
  tick: 1000 + round,
  round,
  type: "kill",
  attackerId: "76561198000000002",
  victimId: "76561198000000001",
  attackerTeam: "T",
  victimTeam: "CT",
  headshot: true,
  weapon: "AK-47",
  attackerPos: { x: 900, y: 200, z: 10 },
  victimPos: { x: 100, y: 200, z: 10 },
  attackerPlace: "LongDoors",
  victimPlace: "LongA",
  roundTime: 20,
});
const analysis = {
  schemaVersion: "1.0",
  source: "demo",
  map: "de_dust2",
  events: [death("ev_d1", 1), death("ev_d2", 2)],
  players: [player("76561198000000001"), player("76561198000000002")],
  evidence: [],
  caveats: [],
};

const databaseUrl = testDatabaseUrl();
describe.skipIf(!databaseUrl)("training endpoints", () => {
  let admin: Pool;
  let repo: TestDatabase;
  let app: FastifyInstance;
  let directory: string;
  let id: string;
  const schema = "training_" + randomUUID().replaceAll("-", "");
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
    directory = await mkdtemp(resolve(tmpdir(), "cs2-training-"));
    repo.storageDir = directory;
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
    await repo.updateSettings("owner", {
      telemetryConsent: true,
      analyticsConsent: false,
      retentionDays: 7,
    });
    const payload = Buffer.from(`training-${randomUUID()}`);
    id = randomUUID();
    await writeFile(resolve(directory, `${id}.dem`), payload);
    await repo.createJob("owner", {
      id,
      filename: "match.dem",
      objectKey: `${id}.dem`,
      checksum: createHash("sha256").update(payload).digest("hex"),
      size: payload.length,
    });
    const job = await repo.claimJob();
    await repo.finishJob(id, job!.leaseToken, { analysis, coaching: {} });
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

  it("serves the verified catalog to signed-in users only", async () => {
    const r = await app.inject({ url: "/v1/training/catalog", headers });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.entries.length).toBeGreaterThanOrEqual(20);
    for (const e of body.entries) {
      expect(catalogEntrySchema.safeParse(e).success).toBe(true);
      for (const u of [e.url, e.links.steam, e.links.web, e.links.launch])
        if (u)
          expect(u).toMatch(/^(steam:\/\/|https:\/\/steamcommunity\.com\/)/);
    }
    expect((await app.inject({ url: "/v1/training/catalog" })).statusCode).toBe(
      401,
    );
  });

  it("builds the match training plan for the owner only", async () => {
    const url = `/v1/analyses/${id}/training?steamId=76561198000000001`;
    const r = await app.inject({ url, headers });
    expect(r.statusCode).toBe(200);
    const { training } = r.json();
    expect(trainingPlanSchema.safeParse(training).success).toBe(true);
    expect(training.map).toBe("de_dust2");
    expect(training.sessions[0].step).toBe("review");
    const death = training.teleports.find(
      (t: { kind: string }) => t.kind === "death",
    );
    expect(death).toMatchObject({
      callout: "LongA",
      setpos: "setpos_exact 100.0 200.0 12.0",
      setang: "setang 0.00 0.00 0",
    });
    for (const [path, auth, status] of [
      [url, other, 404],
      [url, {}, 401],
      [`/v1/analyses/${id}/training`, headers, 400],
      [`/v1/analyses/${id}/training?steamId=bad;id`, headers, 400],
      [`/v1/analyses/${id}/training?steamId=76561198000000009`, headers, 404],
      [`/v1/analyses/${randomUUID()}/training?steamId=1`, headers, 404],
    ] as const) {
      const res = await app.inject({ url: path, headers: auth });
      expect([path, res.statusCode]).toEqual([path, status]);
    }
  });

  it("adds training to the stored reviews response and recommends from own matches", async () => {
    const r = await app.inject({
      url: `/v1/analyses/${id}/reviews?steamId=76561198000000001`,
      headers,
    });
    expect(r.statusCode).toBe(200);
    expect(trainingPlanSchema.safeParse(r.json().training).success).toBe(true);
    const none = await app.inject({ url: "/v1/training/recommended", headers });
    expect(none.json()).toMatchObject({
      steamId: null,
      latest: null,
      week: [],
    });
    const identity = await app.inject({
      method: "PUT",
      url: "/v1/coach/identity",
      headers,
      payload: { steamId: "76561198000000001", analysisIds: [id] },
    });
    expect(identity.statusCode).toBe(200);
    const rec = await app.inject({ url: "/v1/training/recommended", headers });
    expect(rec.statusCode).toBe(200);
    expect(rec.json()).toMatchObject({
      steamId: "76561198000000001",
      latest: { analysisId: id, map: "de_dust2" },
      matches: 1,
    });
    expect(rec.json().week).toHaveLength(7);
  });
});
