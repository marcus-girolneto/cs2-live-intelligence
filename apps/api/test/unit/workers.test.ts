import { describe, expect, it } from "vitest";
import type { Coaching } from "@cs2/contracts";
import { AnalysesService } from "../../src/modules/analyses/analyses.service.js";
import {
  ViewerPolicy,
  publicCoaching,
} from "../../src/modules/coaching/viewer.policy.js";
import type { FeedbackRepository } from "../../src/modules/feedback/feedback.repository.js";
import { FeedbackService } from "../../src/modules/feedback/feedback.service.js";
import type {
  ClaimedJob,
  JobOutcome,
  JobQueueRepository,
} from "../../src/modules/matches/job-queue.repository.js";
import type { RetentionRepository } from "../../src/modules/matches/retention.repository.js";
import type { ConsentLookup } from "../../src/modules/privacy/privacy.repository.js";
import { DemoProcessingWorker } from "../../src/workers/demo-processing.worker.js";
import { RetentionWorker } from "../../src/workers/retention.worker.js";
import { appError, FakeObjectStorage, FakeReplayStorage } from "./fakes.js";

const JOB = "0b8f2d1c-1111-2222-3333-444455556666";
const HOUR = 3600000;

class FakeRetention implements RetentionRepository {
  retained = 0;
  deleted: string[] = [];
  pending = [`${JOB}.dem`];
  known = new Set<string>();
  async retain() {
    this.retained++;
  }
  async pendingDeletions() {
    return this.pending;
  }
  async deletedFile(key: string) {
    this.deleted.push(key);
  }
  async knownObjects() {
    return this.known;
  }
}

describe("RetentionWorker", () => {
  it("applies retention, deletes scheduled files and sweeps only stale orphans", async () => {
    const repo = new FakeRetention();
    const storage = new FakeObjectStorage();
    const replays = new FakeReplayStorage();
    const known = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee1";
    repo.known.add(`${known}.dem`);
    const entries: Record<string, number> = {
      [`${known}.dem`]: 2 * HOUR,
      [`${known}.replay.json.gz`]: 2 * HOUR,
      "eeeeeeee-bbbb-cccc-dddd-eeeeeeeeeee2.dem": 2 * HOUR,
      "ffffffff-bbbb-cccc-dddd-eeeeeeeeeee2.dem": 60_000,
      "cccccccc-bbbb-cccc-dddd-eeeeeeeeeee2.replay.json.gz": 2 * HOUR,
      ".replay-abc.tmp": 2 * HOUR,
      ".replay-new.tmp": 1000,
      "notes.txt": 9 * HOUR,
    };
    for (const [name, age] of Object.entries(entries))
      storage.ages.set(name, age);
    await new RetentionWorker(repo, storage, replays).run();
    expect(repo.retained).toBe(1);
    expect(repo.deleted).toEqual([`${JOB}.dem`]);
    expect(replays.removed).toEqual([JOB]);
    expect(storage.removed.sort()).toEqual(
      [
        `${JOB}.dem`,
        "eeeeeeee-bbbb-cccc-dddd-eeeeeeeeeee2.dem",
        "cccccccc-bbbb-cccc-dddd-eeeeeeeeeee2.replay.json.gz",
        ".replay-abc.tmp",
      ].sort(),
    );
  });
});

class FakeQueue implements JobQueueRepository {
  finished: JobOutcome[] = [];
  jobs: ClaimedJob[] = [
    { id: JOB, ownerId: "o", objectKey: `${JOB}.dem`, leaseToken: "lease" },
  ];
  async claim() {
    return this.jobs.shift();
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
function worker(parse: () => Promise<unknown>, consentGiven = true) {
  const queue = new FakeQueue();
  const replays = new FakeReplayStorage();
  const consent: ConsentLookup = {
    settings: async () => ({
      telemetryConsent: consentGiven,
      analyticsConsent: false,
      retentionDays: 30,
    }),
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
  const w = new DemoProcessingWorker(
    queue,
    consent,
    { parse },
    { path: (k) => `/objects/${k}` },
    replays,
    coach,
  );
  return { queue, replays, w };
}

describe("DemoProcessingWorker", () => {
  it("completes a parsed demo with analysis and offline coaching", async () => {
    const { queue, w } = worker(async () => DEMO);
    await w.runOnce();
    await w.runOnce();
    expect(queue.finished).toHaveLength(1);
    expect(queue.finished[0]).toMatchObject({
      analysis: { source: "demo", map: "de_mirage" },
      coaching: { mode: "offline" },
    });
    expect(w.counters).toEqual({ complete: 1, failed: 0, errors: 0 });
  });
  it("keeps parser messages, hides other failures and drops the replay artifact", async () => {
    const parserFail = worker(async () => {
      throw new Error("Demo parser deadline exceeded");
    });
    await parserFail.w.runOnce();
    expect(parserFail.queue.finished).toEqual([
      { error: "Demo parser deadline exceeded" },
    ]);
    expect(parserFail.replays.removed).toEqual([JOB]);
    const withdrawn = worker(async () => DEMO, false);
    await withdrawn.w.runOnce();
    expect(withdrawn.queue.finished).toEqual([
      {
        error:
          "Demo analysis failed contract validation or coaching generation",
      },
    ]);
    expect(withdrawn.w.counters.failed).toBe(1);
  });
  it("counts infrastructure errors and stops accepting runs", async () => {
    const { queue, w } = worker(async () => DEMO);
    queue.claim = async () => {
      throw new Error("db down");
    };
    await w.runOnce();
    expect(w.counters.errors).toBe(1);
    await w.stop();
    queue.claim = async () => undefined;
    await w.runOnce();
    expect(w.counters.errors).toBe(1);
  });
});

describe("FeedbackService", () => {
  it("maps consent/quota refusals to 403", async () => {
    const repo: FeedbackRepository = {
      feedback: async () => undefined,
      productEvent: async () => false,
    };
    const service = new FeedbackService(repo);
    expect((await appError(service.submit("o", { rating: 5 }))).body).toEqual({
      error: "Analytics consent required or feedback quota reached",
    });
    expect((await appError(service.track("o", "click", {}))).status).toBe(403);
    const ok = new FeedbackService({
      feedback: async () => ({ id: "f" }),
      productEvent: async () => true,
    });
    expect(await ok.submit("o", { rating: 4 })).toEqual({ id: "f" });
    await expect(ok.track("o", "click", { a: 1 })).resolves.toBeUndefined();
  });
});

describe("AnalysesService and ViewerPolicy", () => {
  const coaching = {
    mode: "provider",
    provenance: { promptVersion: "v1", model: "m", provider: "p" },
  };
  const service = new AnalysesService({
    analysis: async (owner, id) =>
      owner === "o" ? { id, analysis: {}, coaching } : undefined,
  });
  it("redacts model identity for non-admins only", async () => {
    expect(
      (await service.get("o", "a", ViewerPolicy.for(false))).coaching,
    ).toEqual({
      mode: "provider",
      provenance: { promptVersion: "v1" },
    });
    expect((await service.get("o", "a", ViewerPolicy.for(true))).coaching).toBe(
      coaching,
    );
    expect(
      (await appError(service.get("x", "a", ViewerPolicy.for(true)))).body,
    ).toEqual({ error: "Analysis not found" });
  });
  it("redacts reviews, live calls and call metadata", () => {
    const user = ViewerPolicy.for(false);
    expect(
      user.review({ id: "r", provider: "p", model: "m", coaching }),
    ).toEqual({
      id: "r",
      provider: undefined,
      model: undefined,
      coaching: publicCoaching(coaching),
    });
    expect(user.liveCall({ id: "c", model: "m" })).toEqual({
      id: "c",
      model: undefined,
    });
    expect(user.callMeta({ latencyMs: 1, attempts: 2, model: "m" })).toEqual({
      latencyMs: 1,
      attempts: 2,
    });
    expect(ViewerPolicy.for(true).liveCall({ model: "m" })).toEqual({
      model: "m",
    });
  });
});
