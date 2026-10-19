import type { Readable } from "node:stream";
import type { Analysis } from "@cs2/contracts";
import type { ServerMessage } from "@cs2/contracts";
import type { LiveBroadcaster } from "../../src/infrastructure/realtime/live-broadcaster.js";
import type {
  ObjectStorage,
  StoredObject,
} from "../../src/infrastructure/storage/object-storage.js";
import type { ReplayStorage } from "../../src/infrastructure/storage/replay-storage.js";
import type { OwnerInvalidation } from "../../src/modules/live/owner-invalidation.js";
import type {
  PlanRecord,
  PlansRepository,
  SubscriptionRecord,
} from "../../src/modules/plans/plans.repository.js";
import type { Reservation } from "../../src/modules/usage/usage.service.js";
import { AppError } from "../../src/shared/errors/index.js";

/** Awaits a promise expected to reject with an AppError; returns status + body. */
export async function appError(promise: Promise<unknown>): Promise<{
  status: number;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  if (!(error instanceof AppError))
    throw new Error(`Expected AppError, got ${String(error)}`);
  return {
    status: error.statusCode,
    body: error.body(),
    headers: error.headers,
  };
}

export class RecordingInvalidation implements OwnerInvalidation {
  owners: string[] = [];
  invalidate(ownerId: string): void {
    this.owners.push(ownerId);
  }
}

/** A reservation that counts releases. */
export class CountingReservation implements Reservation {
  released = 0;
  async release(): Promise<void> {
    this.released++;
  }
}

export const plan = (
  id: string,
  sort: number,
  limits: Partial<PlanRecord["limits"]> = {},
  active = true,
): PlanRecord => ({
  id,
  name: id,
  prices: {},
  limits: {
    aiReviewsPerDay: 1,
    liveAiMatchesPerDay: 0,
    uploadsPerDay: 2,
    retentionDaysMax: 30,
    ...limits,
  },
  features: { clipExport: false, perMapLearning: id === "pro" },
  stripePrices: {},
  active,
  sort,
});

export class FakePlansRepository implements PlansRepository {
  plans = new Map<string, PlanRecord>([
    ["free", plan("free", 0)],
    ["pro", plan("pro", 1, { aiReviewsPerDay: 10, retentionDaysMax: 365 })],
  ]);
  subs = new Map<string, SubscriptionRecord>();
  roles = new Map<string, "user" | "admin">([
    ["u1", "user"],
    ["boss", "admin"],
  ]);
  retention = new Map<string, number>([["u1", 365]]);
  audits: Array<{ action: string; details: unknown }> = [];
  async listPlans() {
    return [...this.plans.values()].sort((a, b) => a.sort - b.sort);
  }
  async getPlan(id: string) {
    return this.plans.get(id);
  }
  async savePlan(p: PlanRecord) {
    this.plans.set(p.id, p);
  }
  async role(ownerId: string) {
    return this.roles.get(ownerId);
  }
  async userExists(ownerId: string) {
    return this.roles.has(ownerId);
  }
  async subscription(ownerId: string) {
    return this.subs.get(ownerId);
  }
  async subscriptions(ids: string[]) {
    return ids
      .map((id) => this.subs.get(id))
      .filter((s): s is SubscriptionRecord => !!s);
  }
  async saveSubscription(s: SubscriptionRecord) {
    this.subs.set(s.ownerId, s);
  }
  async findSubscriptionByStripe() {
    return undefined;
  }
  async retentionDays(ownerId: string) {
    return this.retention.get(ownerId);
  }
  async clampRetention(ownerId: string, max: number) {
    const current = this.retention.get(ownerId);
    if (current !== undefined && current > max)
      this.retention.set(ownerId, max);
  }
  async audit(_adminId: string, action: string, details: unknown) {
    this.audits.push({ action, details });
  }
}

/** In-memory object storage keyed by name, with controllable entry ages. */
export class FakeObjectStorage implements ObjectStorage {
  objects = new Map<string, number>();
  ages = new Map<string, number>();
  removed: string[] = [];
  failWrite = false;
  async ensureReady() {}
  async write(key: string, source: Readable): Promise<StoredObject> {
    if (this.failWrite) throw new Error("disk");
    let size = 0;
    for await (const chunk of source) size += (chunk as Buffer).length;
    this.objects.set(key, size);
    return { size, checksum: "c" };
  }
  async remove(key: string) {
    this.removed.push(key);
    this.objects.delete(key);
    this.ages.delete(key);
  }
  async exists(key: string) {
    return this.objects.has(key);
  }
  async entries() {
    return [...new Set([...this.objects.keys(), ...this.ages.keys()])];
  }
  async entryAgeMs(name: string) {
    return this.ages.get(name) ?? 0;
  }
  async removeEntry(name: string) {
    await this.remove(name);
  }
}

export class FakeReplayStorage implements ReplayStorage {
  removed: string[] = [];
  pathFor(jobId: string) {
    return `/replays/${jobId}`;
  }
  async read() {
    return undefined;
  }
  async remove(jobId: string) {
    this.removed.push(jobId);
  }
}

export class FakeBroadcaster implements LiveBroadcaster {
  connections = 0;
  published: Array<{
    ownerId: string;
    sessionId: string;
    message: ServerMessage;
  }> = [];
  disconnected: string[] = [];
  subscribe() {}
  send() {}
  publish(ownerId: string, sessionId: string, message: ServerMessage) {
    this.published.push({ ownerId, sessionId, message });
  }
  disconnectOwner(ownerId: string) {
    this.disconnected.push(ownerId);
  }
  close() {}
}

const metric = (value: number) => ({
  value,
  numerator: value,
  denominator: 1,
  complete: true,
  formula: "x",
  evidenceIds: [],
});
/** Smallest contract-valid analysis with the given players. */
export function analysisWith(steamIds: string[], map = "de_mirage"): Analysis {
  return {
    schemaVersion: "1.0",
    source: "demo",
    map,
    players: steamIds.map((steamId) => ({
      steamId,
      kills: metric(10),
      deaths: metric(5),
      adr: metric(80),
      headshotPercentage: metric(50),
    })),
    evidence: [],
    caveats: [],
  };
}
