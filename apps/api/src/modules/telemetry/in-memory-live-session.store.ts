import type { LiveState, TelemetryEnvelope } from "@cs2/contracts";
import type { DeviceIdentity } from "../../shared/http/principal.js";
import type {
  IngestResult,
  LiveSessionStore,
  StoredSession,
} from "./telemetry.repository.js";

const DAY_MS = 86400000;

/** Bounded in-process store for the database-less mode; entries expire after 24 h. */
export class InMemoryLiveSessionStore implements LiveSessionStore {
  private readonly sessions = new Map<string, StoredSession & { at: number }>();
  private readonly events = new Map<string, number>();
  constructor(
    private readonly now: () => number,
    private readonly maxSessions = 1000,
    private readonly maxEvents = 10000,
  ) {}

  async ingest(
    event: TelemetryEnvelope,
    state: LiveState,
    device: DeviceIdentity,
  ): Promise<IngestResult> {
    const previous = this.sessions.get(event.sessionId);
    if (
      previous &&
      (previous.ownerId !== device.ownerId ||
        previous.deviceId !== device.deviceId)
    )
      return "session_mismatch";
    const key = JSON.stringify([device.deviceId, event.eventId]);
    if (this.events.has(key)) return "duplicate";
    trim(this.events, this.maxEvents);
    this.events.set(key, this.now());
    if (previous && event.sequence <= previous.state.sequence) return "ignored";
    if (!previous) trim(this.sessions, this.maxSessions);
    this.sessions.set(event.sessionId, {
      ownerId: device.ownerId,
      deviceId: device.deviceId,
      state,
      at: this.now(),
    });
    return "accepted";
  }

  async session(id: string): Promise<StoredSession | undefined> {
    return this.sessions.get(id);
  }

  async history(ownerId: string): Promise<LiveState[]> {
    return [...this.sessions.values()]
      .filter((s) => s.ownerId === ownerId)
      .sort((a, b) => b.at - a.at)
      .slice(0, 100)
      .map((s) => s.state);
  }

  prune(): void {
    const now = this.now();
    for (const [key, entry] of this.sessions)
      if (now - entry.at > DAY_MS) this.sessions.delete(key);
    for (const [key, at] of this.events)
      if (now - at > DAY_MS) this.events.delete(key);
  }
}

/** Evicts the oldest entries until there is room for one more. */
function trim<T>(map: Map<string, T>, cap: number): void {
  while (map.size >= cap) {
    const key = map.keys().next().value;
    if (key === undefined) break;
    map.delete(key);
  }
}
