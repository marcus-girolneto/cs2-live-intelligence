import type { ObjectStorage } from "../infrastructure/storage/object-storage.js";
import { isObjectKey } from "../infrastructure/storage/object-storage.js";
import {
  replayJobId,
  type ReplayStorage,
} from "../infrastructure/storage/replay-storage.js";
import type { RetentionRepository } from "../modules/matches/retention.repository.js";
import {
  eventsJobId,
  type AnalysisEventsStore,
} from "../infrastructure/storage/events-storage.js";

const STALE_MS = 3600000;

/**
 * Applies per-account retention, deletes scheduled files, and sweeps orphans: objects whose
 * DB insert never happened, replay artifacts of deleted demos and stale parser temp files.
 */
export class RetentionWorker {
  constructor(
    private readonly retention: RetentionRepository,
    private readonly storage: ObjectStorage,
    private readonly replays: ReplayStorage,
    private readonly events?: Pick<AnalysisEventsStore, "remove">,
  ) {}

  async run(): Promise<void> {
    await this.retention.retain();
    for (const key of await this.retention.pendingDeletions()) {
      await this.storage.remove(key);
      await this.replays.remove(key.slice(0, -4));
      await this.events?.remove(key.slice(0, -4));
      await this.retention.deletedFile(key);
    }
    // Crash between filesystem upload and DB insert cannot leave an object forever.
    const known = await this.retention.knownObjects();
    for (const name of await this.storage.entries())
      await this.sweep(name, known);
  }

  private async sweep(name: string, known: Set<string>): Promise<void> {
    // Replay and events artifacts follow their demo; temp files are swept when stale.
    const replayOf = replayJobId(name) ?? eventsJobId(name);
    if (
      replayOf !== undefined ||
      /^\.(replay|events|link)-.*\.tmp$/.test(name)
    ) {
      if (replayOf !== undefined && known.has(replayOf + ".dem")) return;
      if ((await this.storage.entryAgeMs(name)) > STALE_MS)
        await this.storage.removeEntry(name);
      return;
    }
    if (!isObjectKey(name) || known.has(name)) return;
    if ((await this.storage.entryAgeMs(name)) > STALE_MS)
      await this.storage.remove(name);
  }
}
