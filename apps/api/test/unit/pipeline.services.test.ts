import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { Coaching } from "@cs2/contracts";
import { FileAnalysisEventsStore } from "../../src/infrastructure/storage/events-storage.js";
import { FileAnalysisStore } from "../../src/infrastructure/storage/analysis-storage.js";
import { HydratingMatchesRepository } from "../../src/modules/analyses/analysis-reader.js";
import type {
  ClaimedJob,
  FinishResult,
  JobOutcome,
  JobQueueRepository,
} from "../../src/modules/matches/job-queue.repository.js";
import type {
  MatchesRepository,
  MatchRow,
} from "../../src/modules/matches/matches.repository.js";
import type { PipelineRepository } from "../../src/modules/matches/pipeline.repository.js";
import { matchRecord } from "../../src/modules/matches/match-record.js";
import { silentLogger } from "../../src/shared/logging/logger.js";
import { DemoProcessingWorker } from "../../src/workers/demo-processing.worker.js";
import { ParserUpgradeJob } from "../../src/workers/parser-upgrade.worker.js";
import { FakeReplayStorage } from "./fakes.js";

const JOB = "0b8f2d1c-1111-2222-3333-444455556666";
const OTHER = "0b8f2d1c-1111-2222-3333-444455557777";
const dirs: string[] = [];
async function store(): Promise<{
  dir: string;
  events: FileAnalysisEventsStore;
}> {
  const dir = await mkdtemp(join(tmpdir(), "cs2-events-"));
  dirs.push(dir);
  return { dir, events: new FileAnalysisEventsStore(dir, 2) };
}
afterAll(async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

describe("FileAnalysisEventsStore", () => {
  it("round-trips gzip events with private files and fresh arrays per reader", async () => {
    const { dir, events } = await store();
    const many = Array.from({ length: 20_000 }, (_, i) => ({ id: `e${i}` }));
    expect(await events.write(JOB, many)).toBe(20_000);
    expect(await events.read(JOB)).toEqual(many);
    // Readers get their own array (the cache is never handed out for mutation).
    (await events.read(JOB))!.length = 0;
    expect(await events.read(JOB)).toHaveLength(20_000);
    expect((await stat(join(dir, `${JOB}.events.json.gz`))).mode & 0o777).toBe(
      0o600,
    );
    await events.remove(JOB);
    expect(await events.read(JOB)).toBeUndefined();
    expect(await readdir(dir)).toEqual([]);
    expect(() => events.pathFor("../x")).toThrow("Invalid object key");
  });
});

describe("FileAnalysisStore", () => {
  it("round-trips the match document, replaces it atomically and caches by mtime", async () => {
    const { dir } = await store();
    const docs = new FileAnalysisStore(dir, 1);
    await docs.write(JOB, { map: "de_dust2", players: [{ steamId: "1" }] });
    const first = await docs.read(JOB);
    expect(first).toEqual({ map: "de_dust2", players: [{ steamId: "1" }] });
    // A reader mutating its copy never changes the cached document.
    first!.map = "changed";
    expect((await docs.read(JOB))?.map).toBe("de_dust2");
    await docs.write(JOB, { map: "de_inferno", players: [] });
    expect((await docs.read(JOB))?.map).toBe("de_inferno");
    expect((await readdir(dir)).sort()).toEqual([`${JOB}.analysis.json.gz`]);
    await docs.remove(JOB);
    expect(await docs.read(JOB)).toBeUndefined();
    expect(() => docs.pathFor("../x")).toThrow("Invalid object key");
  });
});

class OneJobQueue implements JobQueueRepository {
  finished: JobOutcome[] = [];
  existing: string | undefined;
  /** Simulates a concurrent parse of the same bytes that won the race. */
  winner: string | undefined;
  constructor(private job: ClaimedJob | undefined) {}
  async claim() {
    const job = this.job;
    this.job = undefined;
    return job;
  }
  async matchFor() {
    return this.existing;
  }
  async finish(
    _id: string,
    _lease: string,
    outcome: JobOutcome,
  ): Promise<FinishResult> {
    this.finished.push(outcome);
    if (!("match" in outcome)) return { status: "fenced" };
    return this.winner
      ? { status: "linked", matchId: this.winner, discarded: outcome.match.id }
      : { status: "linked", matchId: outcome.match.id };
  }
}
const DEMO = {
  schemaVersion: "1.0",
  parserVersion: "test",
  map: "de_mirage",
  complete: true,
  completeness: { kills: true, damage: true, rounds: true },
  players: [{ steamId: "76561198000000001" }],
  rounds: [],
  events: [],
};
const coach = {
  coach: async () =>
    ({
      schemaVersion: "1.0",
      mode: "offline",
      insights: [],
      caveats: [],
    }) as Coaching,
};
const consent = {
  settings: async () => ({
    telemetryConsent: true,
    analyticsConsent: false,
    retentionDays: 30,
  }),
};
function processing(
  job: ClaimedJob,
  parse: () => Promise<unknown>,
  deduped = false,
  setup: (queue: OneJobQueue) => void = () => undefined,
) {
  const queue = new OneJobQueue(job);
  setup(queue);
  const replays = new FakeReplayStorage();
  const written: string[] = [];
  const documents: string[] = [];
  const removed: string[] = [];
  const parsedTo: string[] = [];
  let parsed = 0;
  const w = new DemoProcessingWorker(
    queue,
    consent,
    {
      parse: (_demo, replayPath) => {
        parsed++;
        parsedTo.push(replayPath ?? "");
        return parse();
      },
    },
    { path: (k) => `/objects/${k}` },
    replays,
    coach,
    {
      analyses: {
        write: async (id) => {
          documents.push(id);
        },
        remove: async () => undefined,
      },
      events: {
        write: async (id, events) => {
          written.push(id);
          return events.length;
        },
        remove: async (id) => {
          removed.push(id);
        },
      },
      dedupe: { tryComplete: async () => deduped },
      parserVersion: async () => "test",
    },
  );
  return {
    queue,
    replays,
    w,
    written,
    documents,
    removed,
    parsedTo,
    parsed: () => parsed,
  };
}
const job = (kind: ClaimedJob["kind"]): ClaimedJob => ({
  id: JOB,
  ownerId: "o",
  objectKey: `${JOB}.dem`,
  leaseToken: "lease",
  checksum: "abc",
  kind,
});

const finishedMatch = (queue: OneJobQueue) =>
  (queue.finished[0] as { match: ReturnType<typeof matchRecord> }).match;

describe("DemoProcessingWorker pipeline stages", () => {
  it("writes a new match's document and events to object storage, slim row to Postgres", async () => {
    const p = processing(job("fresh"), async () => DEMO);
    await p.w.runOnce();
    const match = finishedMatch(p.queue);
    expect(match.id).not.toBe(JOB);
    expect(p.written).toEqual([match.id]);
    expect(p.documents).toEqual([match.id]);
    expect(p.parsedTo).toEqual([`/replays/${match.id}`]);
    expect(match).toMatchObject({
      checksum: "abc",
      map: "de_mirage",
      eventsCount: 0,
      analysisKey: `${match.id}.analysis.json.gz`,
    });
    expect(match.summary.events).toBeUndefined();
    expect(match.summary.players).toBeUndefined();
  });
  it("overwrites the existing match of the same bytes and parser version (admin re-run)", async () => {
    const p = processing(
      { ...job("fresh"), force: true },
      async () => DEMO,
      true,
      (queue) => {
        queue.existing = OTHER;
      },
    );
    await p.w.runOnce();
    // Forced: no dedupe even though one would match.
    expect(p.parsed()).toBe(1);
    expect(finishedMatch(p.queue).id).toBe(OTHER);
    expect(p.parsedTo).toEqual([`/replays/${OTHER}`]);
  });
  it("removes its files when a concurrent parse of the same bytes won", async () => {
    const p = processing(
      job("fresh"),
      async () => DEMO,
      false,
      (queue) => {
        queue.winner = OTHER;
      },
    );
    await p.w.runOnce();
    const mine = finishedMatch(p.queue).id;
    expect(p.removed).toEqual([mine]);
    expect(p.replays.removed).toEqual([mine]);
  });
  it("completes a fresh job by dedupe without parsing", async () => {
    const p = processing(job("fresh"), async () => DEMO, true);
    await p.w.runOnce();
    expect(p.parsed()).toBe(0);
    expect(p.queue.finished).toEqual([]);
    expect(p.w.counters.complete).toBe(1);
  });
  it("keeps the files of an existing match when a re-parse fails", async () => {
    const p = processing(
      job("reprocess"),
      async () => {
        throw new Error("Demo parser could not read this demo");
      },
      false,
      (queue) => {
        queue.existing = OTHER;
      },
    );
    await p.w.runOnce();
    expect(p.parsed()).toBe(1);
    expect(p.replays.removed).toEqual([]);
    expect(p.removed).toEqual([]);
    expect(p.queue.finished).toEqual([
      { error: "Demo parser could not read this demo" },
    ]);
  });
  it("removes the artifacts of a failed parse of a new match", async () => {
    const p = processing(job("fresh"), async () => ({ bad: true }));
    await p.w.runOnce();
    expect(p.replays.removed).toHaveLength(1);
    expect(p.removed).toEqual(p.replays.removed);
    expect(p.queue.finished).toHaveLength(1);
  });
});

describe("matchRecord", () => {
  it("derives score per starting team, rounds and per-player numbers", () => {
    const metric = (value: number) => ({
      value,
      numerator: value,
      denominator: 1,
      complete: true,
      formula: "x",
      evidenceIds: [],
    });
    const rounds = (side: "CT" | "T", won: boolean[]) =>
      won.map((w, i) => ({
        round: i + 1,
        side,
        kills: 0,
        headshots: 0,
        damage: 0,
        died: false,
        traded: false,
        damageAssist: i === 0,
        won: w,
      }));
    const record = matchRecord({
      id: JOB,
      checksum: "abc",
      analysis: {
        schemaVersion: "1.0",
        source: "demo",
        map: "de_nuke",
        provenance: { parserVersion: "p1", metricVersion: "m1" },
        roundOutcomes: [
          { round: 1, winner: "CT" },
          { round: 2, winner: "T" },
          { round: 3, winner: "CT" },
        ],
        players: [
          {
            steamId: "1",
            name: "a",
            kills: metric(20),
            deaths: metric(10),
            adr: metric(91.456),
            headshotPercentage: metric(50),
            advanced: { kast: metric(75) },
            rounds: rounds("CT", [true, false, true]),
          },
          {
            steamId: "2",
            kills: metric(5),
            deaths: metric(15),
            adr: { ...metric(0), value: null, complete: false },
            headshotPercentage: metric(10),
            rounds: rounds("T", [false, true, false]),
          },
        ],
        evidence: [{ id: "e" }],
        caveats: ["c"],
      },
      coaching: { mode: "offline" },
      tickRate: 64,
      analysisKey: `${JOB}.analysis.json.gz`,
      eventsCount: 12,
    });
    expect(record).toMatchObject({
      parserVersion: "p1",
      map: "de_nuke",
      tickRate: 64,
      roundsCount: 3,
      scoreCt: 2,
      scoreT: 1,
      summary: { caveats: ["c"], provenance: { parserVersion: "p1" } },
    });
    expect(record.summary.evidence).toBeUndefined();
    expect(record.players).toEqual([
      expect.objectContaining({
        steamId: "1",
        teamStart: "CT",
        kills: 20,
        adr: 91.46,
        kast: 75,
        assists: 1,
        roundsPlayed: 3,
      }),
      expect.objectContaining({ steamId: "2", teamStart: "T", adr: null }),
    ]);
  });
});

describe("HydratingMatchesRepository", () => {
  it("builds the full analysis from the match document and events in object storage", async () => {
    const row = (id: string, matchId: string): MatchRow => ({
      id,
      matchId,
      filename: "m.dem",
      createdAt: "2026-10-19T00:00:00.000Z",
      summary: { caveats: ["slim"] },
      coaching: {},
    });
    const rows: Record<string, MatchRow> = {
      [JOB]: row(JOB, "m1"),
      [OTHER]: row(OTHER, "m2"),
    };
    const inner = {
      matchRow: async (_o: string, id: string) => rows[id],
      completedRows: async () => Object.values(rows),
    } as unknown as MatchesRepository;
    const reads: string[] = [];
    const reader = new HydratingMatchesRepository(
      inner,
      {
        read: async (id) =>
          id === "m1" ? { players: [{ steamId: "1" }] } : undefined,
      },
      {
        read: async (id) => {
          reads.push(id);
          return id === "m1" ? [{ id: "stored" }] : undefined;
        },
      },
    );
    expect(await reader.analysis("o", JOB)).toEqual({
      id: JOB,
      analysis: { players: [{ steamId: "1" }], events: [{ id: "stored" }] },
      coaching: {},
    });
    // A missing document falls back to the slim summary without players.
    expect((await reader.analysis("o", OTHER))?.analysis).toEqual({
      caveats: ["slim"],
      players: [],
      evidence: [],
    });
    expect(await reader.analysis("o", "missing")).toBeUndefined();
    const all = await reader.completedAnalyses("o");
    expect(all.map((a) => a.id)).toEqual([JOB, OTHER]);
    expect(reads).toEqual(["m1", "m2", "m1", "m2"]);
  });
});

function fakePipeline(
  overrides: Partial<PipelineRepository>,
): PipelineRepository {
  const none = async () => {
    throw new Error("unexpected");
  };
  return {
    parserVersion: none,
    setParserVersion: none,
    linkExisting: none,
    outdated: none,
    queueReprocess: none,
    reprocessStatus: none,
    ...overrides,
  } as PipelineRepository;
}

describe("maintenance jobs", () => {
  it("records the parser version and queues only outdated jobs whose demo exists", async () => {
    const recorded: string[] = [];
    const queued: string[][] = [];
    await new ParserUpgradeJob(
      { version: async () => "v5+cs2live.5" },
      fakePipeline({
        setParserVersion: async (v) => {
          recorded.push(v);
        },
        outdated: async () => [
          { id: "a", objectKey: "a.dem" },
          { id: "b", objectKey: "b.dem" },
        ],
        queueReprocess: async (ids) => {
          queued.push(ids);
          return ids.length;
        },
      }),
      { exists: async (key) => key === "a.dem" },
      silentLogger,
    ).run();
    expect(recorded).toEqual(["v5+cs2live.5"]);
    expect(queued).toEqual([["a"]]);
  });
  it("dedupes only with a known parser version and logs the shared match", async () => {
    const { AnalysisDedupe } =
      await import("../../src/modules/matches/analysis-dedupe.js");
    const linked: Array<[string, string, string | undefined]> = [];
    const pipeline = fakePipeline({
      parserVersion: async () => "v1",
      linkExisting: async (id, version, lease) => {
        linked.push([id, version, lease]);
        return id === JOB ? "match-1" : undefined;
      },
    });
    const dedupe = new AnalysisDedupe(pipeline, silentLogger);
    expect(await dedupe.tryComplete({ id: JOB, checksum: "c" })).toBe(true);
    expect(
      await dedupe.tryComplete({ id: OTHER, checksum: "c", leaseToken: "l" }),
    ).toBe(false);
    expect(await dedupe.tryComplete({ id: JOB })).toBe(false);
    expect(linked).toEqual([
      [JOB, "v1", undefined],
      [OTHER, "v1", "l"],
    ]);
    const unknown = new AnalysisDedupe(
      fakePipeline({ parserVersion: async () => undefined }),
      silentLogger,
    );
    expect(await unknown.tryComplete({ id: JOB, checksum: "c" })).toBe(false);
  });
});
