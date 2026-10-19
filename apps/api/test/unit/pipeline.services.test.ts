import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { Coaching } from "@cs2/contracts";
import { FileAnalysisEventsStore } from "../../src/infrastructure/storage/events-storage.js";
import { HydratingMatchesRepository } from "../../src/modules/analyses/analysis-reader.js";
import type {
  ClaimedJob,
  JobOutcome,
  JobQueueRepository,
} from "../../src/modules/matches/job-queue.repository.js";
import type { MatchesRepository } from "../../src/modules/matches/matches.repository.js";
import type { PipelineRepository } from "../../src/modules/matches/pipeline.repository.js";
import { silentLogger } from "../../src/shared/logging/logger.js";
import { DemoProcessingWorker } from "../../src/workers/demo-processing.worker.js";
import { EventsMigrationJob } from "../../src/workers/events-migration.worker.js";
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
  it("round-trips gzip events, copies by hard link with independent deletion", async () => {
    const { dir, events } = await store();
    const many = Array.from({ length: 20_000 }, (_, i) => ({ id: `e${i}` }));
    expect(await events.write(JOB, many)).toBe(20_000);
    expect(await events.read(JOB)).toEqual(many);
    // Readers get their own array (the cache is never handed out for mutation).
    (await events.read(JOB))!.length = 0;
    expect(await events.read(JOB)).toHaveLength(20_000);
    expect(await events.copy(JOB, OTHER)).toBe(true);
    await events.remove(JOB);
    expect(await events.read(JOB)).toBeUndefined();
    expect(await events.read(OTHER)).toHaveLength(20_000);
    expect(await events.copy(JOB, OTHER)).toBe(false);
    expect(
      (await stat(join(dir, `${OTHER}.events.json.gz`))).mode & 0o777,
    ).toBe(0o600);
    expect((await readdir(dir)).sort()).toEqual([`${OTHER}.events.json.gz`]);
    expect(() => events.pathFor("../x")).toThrow("Invalid object key");
  });
});

class OneJobQueue implements JobQueueRepository {
  finished: JobOutcome[] = [];
  constructor(private job: ClaimedJob | undefined) {}
  async claim() {
    const job = this.job;
    this.job = undefined;
    return job;
  }
  async finish(_id: string, _lease: string, outcome: JobOutcome) {
    this.finished.push(outcome);
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
) {
  const queue = new OneJobQueue(job);
  const replays = new FakeReplayStorage();
  const written: string[] = [];
  const removed: string[] = [];
  let parsed = 0;
  const w = new DemoProcessingWorker(
    queue,
    consent,
    {
      parse: () => {
        parsed++;
        return parse();
      },
    },
    { path: (k) => `/objects/${k}` },
    replays,
    coach,
    {
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
    },
  );
  return { queue, replays, w, written, removed, parsed: () => parsed };
}
const job = (kind: ClaimedJob["kind"]): ClaimedJob => ({
  id: JOB,
  ownerId: "o",
  objectKey: `${JOB}.dem`,
  leaseToken: "lease",
  checksum: "abc",
  kind,
});

describe("DemoProcessingWorker pipeline stages", () => {
  it("stores events outside the row and records their count", async () => {
    const p = processing(job("fresh"), async () => DEMO);
    await p.w.runOnce();
    expect(p.written).toEqual([JOB]);
    expect(p.queue.finished[0]).toMatchObject({ eventsCount: 0 });
    expect(
      (p.queue.finished[0] as { analysis: Record<string, unknown> }).analysis
        .events,
    ).toBeUndefined();
  });
  it("completes a fresh job by dedupe without parsing", async () => {
    const p = processing(job("fresh"), async () => DEMO, true);
    await p.w.runOnce();
    expect(p.parsed()).toBe(0);
    expect(p.queue.finished).toEqual([]);
    expect(p.w.counters.complete).toBe(1);
  });
  it("always re-parses a background job and keeps its artifacts when that fails", async () => {
    const p = processing(
      job("reprocess"),
      async () => {
        throw new Error("Demo parser could not read this demo");
      },
      true,
    );
    await p.w.runOnce();
    expect(p.parsed()).toBe(1);
    expect(p.replays.removed).toEqual([]);
    expect(p.removed).toEqual([]);
    expect(p.queue.finished).toEqual([
      { error: "Demo parser could not read this demo" },
    ]);
  });
  it("removes the artifacts of a failed fresh job", async () => {
    const p = processing(job("fresh"), async () => ({ bad: true }));
    await p.w.runOnce();
    expect(p.replays.removed).toEqual([JOB]);
    expect(p.removed).toEqual([JOB]);
  });
});

describe("HydratingMatchesRepository", () => {
  it("re-attaches stored events and leaves inline or missing ones alone", async () => {
    const rows: Record<string, unknown> = {
      [JOB]: { players: [] },
      [OTHER]: { players: [], events: [{ id: "inline" }] },
    };
    const inner = {
      analysis: async (_o: string, id: string) =>
        rows[id] ? { id, analysis: rows[id], coaching: {} } : undefined,
      completedAnalyses: async () =>
        Object.entries(rows).map(([id, analysis]) => ({
          id,
          filename: "m.dem",
          analysis,
          createdAt: "2026-10-19T00:00:00.000Z",
        })),
    } as unknown as MatchesRepository;
    const reads: string[] = [];
    const reader = new HydratingMatchesRepository(inner, {
      read: async (id) => {
        reads.push(id);
        return id === JOB ? [{ id: "stored" }] : undefined;
      },
    });
    expect((await reader.analysis("o", JOB))?.analysis).toEqual({
      players: [],
      events: [{ id: "stored" }],
    });
    expect((await reader.analysis("o", OTHER))?.analysis).toEqual(rows[OTHER]);
    expect(await reader.analysis("o", "missing")).toBeUndefined();
    const all = await reader.completedAnalyses("o");
    expect(
      all.map((a) => (a.analysis as { events: unknown[] }).events),
    ).toEqual([[{ id: "stored" }], [{ id: "inline" }]]);
    expect(reads).toEqual([JOB, JOB]);
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
    donor: none,
    completeClone: none,
    outdated: none,
    queueReprocess: none,
    reprocessStatus: none,
    inlineEvents: none,
    eventsMoved: none,
    inlineEventsLeft: async () => 0,
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
  it("migrates events only after a verified write and skips rows that fail", async () => {
    const { events } = await store();
    const moved: Array<[string, number]> = [];
    let served = false;
    await new EventsMigrationJob(
      fakePipeline({
        inlineEvents: async () => {
          if (served) return [];
          served = true;
          return [
            { id: JOB, events: [{ id: "e1" }, { id: "e2" }] },
            { id: "not-a-uuid", events: [{ id: "x" }] },
          ];
        },
        eventsMoved: async (id, count) => {
          moved.push([id, count]);
          return true;
        },
      }),
      events,
      silentLogger,
    ).run();
    expect(moved).toEqual([[JOB, 2]]);
    expect(await events.read(JOB)).toEqual([{ id: "e1" }, { id: "e2" }]);
  });
});
