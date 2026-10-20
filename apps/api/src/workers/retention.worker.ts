import type { ObjectStorage } from "../infrastructure/storage/object-storage.js";
import { isObjectKey } from "../infrastructure/storage/object-storage.js";
import { replayMatchId } from "../infrastructure/storage/replay-storage.js";
import { eventsMatchId } from "../infrastructure/storage/events-storage.js";
import { analysisMatchId } from "../infrastructure/storage/analysis-storage.js";
import type { RetentionRepository } from "../modules/matches/retention.repository.js";

const STALE_MS = 3600000;
/** Match id of a match artifact file name (analysis, events, replay). */
const artifactMatchId = (name: string): string | undefined =>
  analysisMatchId(name) ?? eventsMatchId(name) ?? replayMatchId(name);

/**
 * Applies per-account retention, deletes scheduled files (upload demos and the artifacts of
 * matches no upload references any more), and sweeps orphans: objects whose DB insert never
 * happened, artifacts of deleted matches and stale temp files.
 */
export class RetentionWorker {
  constructor(
    private readonly retention: RetentionRepository,
    private readonly storage: ObjectStorage,
  ) {}

  async run(): Promise<void> {
    await this.retention.retain();
    for (const key of await this.retention.pendingDeletions()) {
      if (isObjectKey(key)) await this.storage.remove(key);
      else if (artifactMatchId(key)) await this.storage.removeEntry(key);
      await this.retention.deletedFile(key);
    }
    // A crash between writing a file and recording it cannot leave an object forever.
    const known = await this.retention.knownObjects();
    for (const name of await this.storage.entries())
      await this.sweep(name, known);
  }

  private async sweep(
    name: string,
    known: { demos: Set<string>; matches: Set<string> },
  ): Promise<void> {
    const matchId = artifactMatchId(name);
    if (matchId !== undefined) {
      if (known.matches.has(matchId)) return;
    } else if (!/^\.(replay|events|analysis|link)-.*\.tmp$/.test(name)) {
      if (!isObjectKey(name) || known.demos.has(name)) return;
    }
    if ((await this.storage.entryAgeMs(name)) > STALE_MS)
      await this.storage.removeEntry(name);
  }
}
