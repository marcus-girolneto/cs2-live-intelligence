import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildHttpApp } from "../src/app.js";
import { RuntimeEnv } from "../src/config/env.js";
import { createContainer, type Container } from "../src/container.js";
import { TestDatabase } from "./support/test-database.js";
import { testDatabaseUrl } from "./support/database-url.js";

const databaseUrl = testDatabaseUrl();
const PLAYERS = Array.from(
  { length: 10 },
  (_, i) => `7656119800000${1000 + i}`,
);

/** GET /v1/analyses/:id/integrity and the Steam ban checks (fake Steam Web API). */
describe.skipIf(!databaseUrl)("match integrity (Postgres)", () => {
  let admin: Pool;
  let repo: TestDatabase;
  let container: Container;
  let app: FastifyInstance;
  let directory: string;
  const steamCalls: string[] = [];
  const schema = "integrity_" + randomUUID().replaceAll("-", "");
  const owner = { authorization: "Bearer owner-token" };
  const other = { authorization: "Bearer other-token" };
  const env: Record<string, string> = { STEAM_WEB_API_KEY: "test-steam-key" };

  beforeAll(async () => {
    admin = new Pool({ connectionString: databaseUrl });
    await admin.query(`create schema ${schema}`);
    const url = new URL(databaseUrl!);
    url.searchParams.set("options", `-c search_path=${schema}`);
    repo = new TestDatabase(url.toString());
    await repo.migrate();
    await repo.seedDev("owner", "owner-token", "d1", "d1-token");
    await repo.seedDev("other", "other-token", "d2", "d2-token");
    directory = await mkdtemp(resolve(tmpdir(), "cs2-integrity-"));
    repo.storageDir = directory;
    const steamFetch = (async (input: string | URL | Request) => {
      const url = new URL(String(input));
      steamCalls.push(url.pathname);
      if (!url.pathname.startsWith("/ISteamUser/GetPlayerBans"))
        return new Response("{}", { status: 404 });
      const ids = (url.searchParams.get("steamids") ?? "").split(",");
      return Response.json({
        players: ids.map((id) => ({
          SteamId: id,
          CommunityBanned: false,
          VACBanned: id === PLAYERS[3],
          NumberOfVACBans: id === PLAYERS[3] ? 1 : 0,
          // PLAYERS[3]: banned 1 day ago (after a match uploaded 5 days ago);
          // PLAYERS[4]: an old game ban from long before the match.
          DaysSinceLastBan: id === PLAYERS[3] ? 1 : id === PLAYERS[4] ? 400 : 0,
          NumberOfGameBans: id === PLAYERS[4] ? 1 : 0,
          EconomyBan: "none",
        })),
      });
    }) as typeof fetch;
    container = createContainer({
      database: repo,
      devices: [],
      owners: [],
      webOrigin: "http://127.0.0.1:3000",
      jobs: { storageDir: directory, parserBin: "unused", disableWorker: true },
      env: new RuntimeEnv(() => env),
      steamFetch,
    });
    app = await buildHttpApp(container);
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

  async function completeMatch(ownerId: string, uploadedDaysAgo: number) {
    const id = randomUUID();
    await repo.createJob(ownerId, {
      id,
      filename: "m.dem",
      objectKey: id + ".dem",
      checksum: "c-" + id,
      size: 1,
    });
    const analysis = {
      schemaVersion: "1.0",
      source: "demo",
      players: PLAYERS.map((steamId) => ({ steamId })),
      evidence: [],
      caveats: [],
      integrity: {
        players: PLAYERS.map((steamId, i) => ({
          steamId,
          level: i === 2 ? "low" : "none",
          reasons:
            i === 2
              ? [{ code: "inhuman_snaps", value: 3, threshold: 2, n: 14 }]
              : [],
        })),
      },
    };
    await repo.pool.query(
      "update uploads set created_at=now()-make_interval(days=>$2) where id=$1",
      [id, uploadedDaysAgo],
    );
    const job = await repo.claimJob();
    await repo.finishJob(id, job!.leaseToken, { analysis, coaching: {} });
    return id;
  }

  it("shows signals and bans to the uploader only, checks again at 7 and 30 days", async () => {
    const id = await completeMatch("owner", 5);
    const before = await app.inject({
      url: `/v1/analyses/${id}/integrity`,
      headers: owner,
    });
    expect(before.statusCode).toBe(200);
    expect(before.json()).toMatchObject({
      bannedAfterMatch: [],
      checkedAt: null,
    });
    expect(before.json().players[2]).toEqual({
      steamId: PLAYERS[2],
      level: "low",
      reasons: [{ code: "inhuman_snaps", value: 3, threshold: 2, n: 14 }],
    });
    for (const headers of [other, {}])
      expect(
        (await app.inject({ url: `/v1/analyses/${id}/integrity`, headers }))
          .statusCode,
      ).toBe(headers === other ? 404 : 401);

    await container.jobs!.daily.run();
    expect(steamCalls.filter((p) => p.includes("GetPlayerBans"))).toHaveLength(
      1,
    );
    const view = (
      await app.inject({ url: `/v1/analyses/${id}/integrity`, headers: owner })
    ).json();
    expect(view.checkedAt).not.toBeNull();
    expect(view.bannedAfterMatch).toHaveLength(10);
    expect(
      view.bannedAfterMatch.filter(
        (b: { bannedAfterMatch: boolean }) => b.bannedAfterMatch,
      ),
    ).toEqual([
      {
        steamId: PLAYERS[3],
        vacBans: 1,
        gameBans: 0,
        daysSinceLastBan: 1,
        bannedAfterMatch: true,
      },
    ]);
    expect(
      view.bannedAfterMatch.find(
        (b: { steamId: string }) => b.steamId === PLAYERS[4],
      ),
    ).toMatchObject({ gameBans: 1, bannedAfterMatch: false });
    // The AI review and every other reader see the same integrity on the analysis.
    const analysis = (
      await app.inject({ url: `/v1/analyses/${id}`, headers: owner })
    ).json().analysis;
    expect(analysis.integrity.bannedAfterMatch).toEqual(view.bannedAfterMatch);
    // Re-check planned 7 days after the upload; nothing else is due now.
    const row = (
      await repo.pool.query(
        "select b.checks,b.next_check_at,extract(epoch from b.next_check_at-x.created_at)/86400 as delay from match_bans b join uploads x on x.match_id=b.match_id where x.id=$1",
        [id],
      )
    ).rows[0];
    expect(row.checks).toBe(1);
    expect(Number(row.delay)).toBeCloseTo(7, 3);
    await container.jobs!.daily.run();
    expect(steamCalls.filter((p) => p.includes("GetPlayerBans"))).toHaveLength(
      1,
    );
    // Deleting the match (its last upload) deletes its ban rows.
    await repo.pool.query("delete from uploads where id=$1", [id]);
    await repo.pool.query("select delete_unreferenced_matches()");
    expect(
      (await repo.pool.query("select count(*)::int n from match_bans")).rows[0]
        .n,
    ).toBe(0);
  });

  it("does not call Steam without a configured key", async () => {
    delete env.STEAM_WEB_API_KEY;
    const calls = steamCalls.length;
    await completeMatch("owner", 1);
    await container.jobs!.daily.run();
    expect(steamCalls.length).toBe(calls);
    env.STEAM_WEB_API_KEY = "test-steam-key";
  });
});
