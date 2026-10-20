import { unwrapData } from "@cs2/coaching";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Pool } from "pg";
import type { FastifyInstance } from "fastify";
import { analyzeDemo } from "@cs2/analytics";
import { generateCoaching } from "@cs2/coaching";
import { teamReviewSchema } from "@cs2/contracts";
import { buildHttpApp } from "../src/app.js";
import { createContainer, type Container } from "../src/container.js";
import { RuntimeEnv } from "../src/config/env.js";
import { TestDatabase } from "./support/test-database.js";
import { testDatabaseUrl } from "./support/database-url.js";

const databaseUrl = testDatabaseUrl();

/**
 * Team reviews, the lobby comparison, match ownership / identity, the progress journey and
 * auto-reviews over Postgres with a local OpenAI-compatible fake provider.
 */
describe.skipIf(!databaseUrl)("coaching extras (Postgres)", () => {
  let admin: Pool;
  let repo: TestDatabase;
  let app: FastifyInstance;
  let container: Container;
  let server: Server;
  let directory: string;
  const calls: { kind: string; body: string }[] = [];
  const schema = "extras_" + randomUUID().replaceAll("-", "");
  const user = { authorization: "Bearer user-token" };
  const env: Record<string, string | undefined> = {};

  const answer = (data: Record<string, unknown>, raw: string) => {
    if (raw.includes("fact checker of this app")) {
      calls.push({ kind: "verify", body: raw });
      return { results: [] };
    }
    if (data.roundCandidates) {
      calls.push({ kind: "team", body: raw });
      return {
        verdict: "Openings win rounds; trade them.",
        roles: [
          {
            alias: "P1",
            strengths: [
              { text: "Wins openings.", evidenceIds: ["team-opening-success"] },
            ],
            fixes: [],
          },
        ],
        patterns: [
          {
            scope: "general",
            text: "Only 20% of your 5 deaths were traded.",
            evidenceIds: ["team-traded-deaths"],
            confidence: "medium",
          },
        ],
        keyRounds: [],
        plan: [
          {
            text: "P2 trades P1",
            owner: "P2",
            targetMetric: "tradedDeathsPct",
            direction: "up",
          },
        ],
        caveats: [],
      };
    }
    calls.push({ kind: "review", body: raw });
    const facts = data.facts as { id: string }[];
    return {
      verdict: "V",
      summary: "Mock.",
      insights: [
        {
          observation: "x",
          evidenceIds: [facts[0]!.id],
          confidence: "low",
          actionablePractice: "y",
          caveats: [],
          kind: "improve",
          scope: "general",
        },
      ],
      keyMoments: [],
      drills: [],
      plan: [
        {
          text: "Trade your entry",
          scope: "general",
          targetMetric: "tradedDeathsPct",
          direction: "up",
        },
      ],
    };
  };

  async function analysisFor(owner: string) {
    const id = randomUUID();
    await repo.createJob(owner, {
      id,
      filename: "a.dem",
      objectKey: id + ".dem",
      checksum: "x",
      size: 1,
    });
    await repo.pool.query(
      "update demo_jobs set status='processing', lease_token='t' where upload_id=$1",
      [id],
    );
    const analysis = analyzeDemo(
      JSON.parse(
        await readFile(
          resolve(
            import.meta.dirname,
            "../../../packages/contracts/fixtures/normalized-demo-enriched.json",
          ),
          "utf8",
        ),
      ),
    );
    await repo.finishJob(id, "t", {
      analysis,
      coaching: await generateCoaching(analysis),
    });
    return id;
  }
  const call = (
    method: "GET" | "POST" | "PUT" | "PATCH",
    url: string,
    payload?: unknown,
  ) =>
    app.inject({
      method,
      url,
      headers: user,
      ...(payload !== undefined ? { payload: payload as object } : {}),
    });

  beforeAll(async () => {
    admin = new Pool({ connectionString: databaseUrl });
    await admin.query(`create schema ${schema}`);
    const url = new URL(databaseUrl!);
    url.searchParams.set("options", `-c search_path=${schema}`);
    repo = new TestDatabase(url.toString());
    await repo.migrate();
    await repo.seedDev(
      "user",
      "user-token",
      "user-device",
      "user-device-token",
    );
    await repo.seedDev(
      "boss",
      "boss-token",
      "boss-device",
      "boss-device-token",
    );
    await repo.pool.query("update users set role='admin' where id='boss'");
    directory = await mkdtemp(resolve(tmpdir(), "cs2-extras-"));
    repo.storageDir = directory;
    server = createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        const body = JSON.parse(raw) as { messages: { content: string }[] };
        const data = unwrapData(body.messages[1]!.content) as Record<
          string,
          unknown
        >;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: { content: JSON.stringify(answer(data, raw)) },
              },
            ],
          }),
        );
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    Object.assign(env, {
      AI_PROVIDER: "local-mock",
      AI_BASE_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
      AI_API_KEY: "sk-test",
      AI_MODEL: "mock",
      AI_MAX_ATTEMPTS: "1",
    });
    container = createContainer({
      database: repo,
      devices: [],
      owners: [],
      webOrigin: "https://app.example",
      apiPublicUrl: "http://127.0.0.1:4000",
      jobs: {
        storageDir: directory,
        parserBin: process.execPath,
        disableWorker: true,
      },
      env: new RuntimeEnv(() => env),
    });
    app = await buildHttpApp(container);
  });
  afterAll(async () => {
    await app?.close();
    await repo?.close();
    await admin?.query(`drop schema ${schema} cascade`);
    await admin?.end();
    server?.close();
    await rm(directory, { recursive: true, force: true });
  });
  beforeEach(() => {
    calls.length = 0;
  });

  it("charges a team review, aliases the players and lists it", async () => {
    const id = await analysisFor("user");
    const poor = await call("POST", `/v1/analyses/${id}/team-review`, {
      steamId: "a",
    });
    expect(poor.statusCode).toBe(402);
    expect(poor.json()).toMatchObject({
      code: "insufficient_credits",
      needed: 4,
    });
    await repo.grantCredits("user", 5);
    const r = await call("POST", `/v1/analyses/${id}/team-review`, {
      steamId: "a",
      lang: "en",
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ creditsSpent: 4, balance: 1 });
    const review = teamReviewSchema.parse(r.json().teamReview);
    expect(review.members).toEqual(["a", "b"]);
    expect(review.plan[0]!.owner).toBe("b");
    expect(review.provenance!.verification).toMatchObject({ verifier: true });
    expect(JSON.stringify(r.json())).not.toMatch(/"model"|mock/);
    const team = calls.find((c) => c.kind === "team")!;
    expect(team.body).not.toMatch(/\\"(?:a|b|c|d)\\"/);
    const list = await call("GET", `/v1/analyses/${id}/team-reviews?steamId=b`);
    expect(list.json().reviews).toHaveLength(1);
    // Reviews stored with aliases (before names were mapped back) are named on read.
    await repo.pool.query(
      `update ai_reviews set payload=jsonb_set(payload,'{verdict}','"P2 trades P1."') where id=$1`,
      [r.json().reviewId],
    );
    const named = await call(
      "GET",
      `/v1/analyses/${id}/team-reviews?steamId=b`,
    );
    expect(named.json().reviews[0].teamReview.verdict).toBe(
      "Player B trades Player A.",
    );
    const rated = await call(
      "POST",
      `/v1/coach/reviews/${r.json().reviewId}/rating`,
      { rating: 5 },
    );
    expect(rated.statusCode).toBe(200);
    const lobby = await call("GET", `/v1/analyses/${id}/lobby?steamId=a`);
    expect(lobby.statusCode).toBe(200);
    expect(
      lobby.json().metrics.find((m: { key: string }) => m.key === "adr"),
    ).toMatchObject({ players: 4 });
  });

  it("classifies ownership, follows the chosen identity and builds the journey", async () => {
    const first = await analysisFor("user");
    const second = await analysisFor("user");
    const before = await call(
      "GET",
      `/v1/matches/ownership?ids=${first},${second}`,
    );
    expect(before.json().items).toEqual([
      { jobId: first, ownership: "external", matchedBy: "none" },
      { jobId: second, ownership: "external", matchedBy: "none" },
    ]);
    let progress = (await call("GET", "/v1/coach/progress")).json();
    expect(progress.identity.status).toBe("missing");
    expect(progress.timeline).toEqual([]);
    const set = await call("PUT", "/v1/coach/identity", { steamId: "a" });
    expect(set.statusCode).toBe(200);
    expect(set.json().updated).toBeGreaterThanOrEqual(2);
    await repo.grantCredits("user", 1);
    expect(
      (await call("POST", `/v1/analyses/${first}/coaching`, { steamId: "a" }))
        .statusCode,
    ).toBe(200);
    const notMine = await call("PATCH", `/v1/matches/${second}/ownership`, {
      ownership: "external",
    });
    expect(notMine.json()).toMatchObject({
      ownership: "external",
      matchedBy: "user",
    });
    progress = (await call("GET", "/v1/coach/progress?map=de_mirage")).json();
    expect(progress.identity.status).toBe("chosen");
    const ids = progress.timeline.map(
      (t: { analysisId: string }) => t.analysisId,
    );
    expect(ids).toContain(first);
    expect(ids).not.toContain(second);
    const entry = progress.timeline.find(
      (t: { analysisId: string }) => t.analysisId === first,
    );
    expect(entry).toMatchObject({
      dateSource: "upload",
      review: {
        planItems: [{ targetMetric: "tradedDeathsPct", direction: "up" }],
      },
    });
    expect(progress.summary.matches).toBe(progress.timeline.length);
    const bad = await call("PATCH", `/v1/matches/${second}/ownership`, {
      ownership: "mine",
      playerSteamId: "zzz",
    });
    expect(bad.statusCode).toBe(400);
  });

  it("auto-reviews new demos of the account once, with the same credit path", async () => {
    await repo.pool.query("delete from auto_reviews");
    await repo.pool.query(
      "update demo_jobs set updated_at = now() - interval '3 days'",
    );
    const statuses = async (ids: string[]) =>
      (
        await call("GET", `/v1/matches/auto-reviews?ids=${ids.join(",")}`)
      ).json().items as {
        jobId: string;
        status: string;
        reason?: string;
        reviewId?: string;
      }[];
    const off = await analysisFor("user");
    await container.jobs!.followUp.runOnce();
    expect(await statuses([off])).toEqual([
      { jobId: off, status: "skipped", reason: "disabled" },
    ]);
    const profile = await call("PUT", "/v1/coach/profile", {
      autoReview: { enabled: true, tier: "quick" },
    });
    expect(profile.json().autoReview).toEqual({
      enabled: true,
      tier: "quick",
      lang: "en",
    });
    // No credits: skipped, nothing charged.
    await repo.pool.query("delete from credit_ledger where owner_id='user'");
    await repo.pool
      .query("delete from credit_wallets where owner_id='user'")
      .catch(() => undefined);
    const poor = await analysisFor("user");
    await container.jobs!.followUp.runOnce();
    const balance = async () =>
      (await call("GET", "/v1/me")).json().credits.balance;
    expect(await statuses([poor])).toEqual([
      { jobId: poor, status: "skipped", reason: "insufficient_credits" },
    ]);
    await repo.grantCredits("user", 1);
    const paid = await analysisFor("user");
    calls.length = 0;
    await container.jobs!.followUp.runOnce();
    await container.jobs!.followUp.runOnce();
    const [done] = await statuses([paid]);
    expect(done).toMatchObject({ jobId: paid, status: "done" });
    expect(done!.reviewId).toBeTruthy();
    expect(calls.filter((c) => c.kind === "review")).toHaveLength(1);
    expect(await balance()).toBe(0);
    // A demo the account is not in.
    await repo.pool.query(
      "update coach_profiles set player_steam_id='zzz' where owner_id='user'",
    );
    const external = await analysisFor("user");
    await container.jobs!.followUp.runOnce();
    expect(await statuses([external])).toEqual([
      { jobId: external, status: "skipped", reason: "not_in_demo" },
    ]);
  });

  it("runs prompt A/B by traffic share, aggregates ratings and runs the AI eval (admin)", async () => {
    const boss = { authorization: "Bearer boss-token" };
    const adminCall = (
      method: "GET" | "POST" | "PUT",
      url: string,
      payload?: unknown,
    ) =>
      app.inject({
        method,
        url,
        headers: boss,
        ...(payload !== undefined ? { payload: payload as object } : {}),
      });
    expect((await call("GET", "/v1/admin/ai/ratings")).statusCode).toBe(403);
    expect(
      (await adminCall("GET", "/v1/admin/ai/eval/latest")).statusCode,
    ).toBe(404);
    const ab = await adminCall("PUT", "/v1/admin/settings", {
      promptAb: { review_team: 100 },
    });
    expect(ab.statusCode).toBe(200);
    const id = await analysisFor("user");
    await repo.grantCredits("user", 4);
    const r = await call("POST", `/v1/analyses/${id}/team-review`, {
      steamId: "a",
    });
    expect(r.json().teamReview.provenance).toMatchObject({
      promptVersion: "igl-team-v5-b",
      variant: "b",
    });
    expect(calls.find((c) => c.kind === "team")!.body).toContain("VARIANT B");
    await call("POST", `/v1/coach/reviews/${r.json().reviewId}/rating`, {
      rating: 4,
    });
    const ratings = (await adminCall("GET", "/v1/admin/ai/ratings")).json()
      .ratings;
    expect(ratings).toContainEqual({
      purpose: "review_team",
      variant: "b",
      promptVersion: "igl-team-v5-b",
      reviews: 1,
      rated: 1,
      avgRating: 4,
    });
    await adminCall("PUT", "/v1/admin/settings", { promptAb: {} });
    const analysis = analyzeDemo(
      JSON.parse(
        await readFile(
          resolve(
            import.meta.dirname,
            "../../../packages/contracts/fixtures/normalized-demo-enriched.json",
          ),
          "utf8",
        ),
      ),
    );
    const run = await adminCall("POST", "/v1/admin/ai/eval/run", {
      langs: ["en"],
      cases: [{ name: "fixture", analysis, steamId: "a" }],
    });
    expect(run.statusCode).toBe(200);
    expect(
      run
        .json()
        .runs.map((x: { purpose: string; ok: boolean }) => [x.purpose, x.ok]),
    ).toEqual([
      ["review_quick", true],
      ["review_deep", true],
      ["review_team", true],
    ]);
    const latest = await adminCall("GET", "/v1/admin/ai/eval/latest");
    expect(latest.json().summary).toMatchObject({
      runs: 3,
      failed: 0,
      cases: ["fixture"],
    });
  });
});
