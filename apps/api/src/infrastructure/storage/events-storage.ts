import { randomUUID } from "node:crypto";
import { readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const MATCH_ID = /^[a-f0-9-]{36}$/;
/** Decoded events above this size are rejected (gzip bomb guard; ~1 MB per real match). */
const MAX_DECOMPRESSED = 256 * 1024 * 1024;

/**
 * Port: the bulky `events` array of an analysis (shots, damage, grenades… about 1 MB per match),
 * kept in object storage as `<matchId>.events.json.gz` next to the analysis and replay of the
 * match (one file per parsed match, shared by every upload of the same demo).
 */
export interface AnalysisEventsStore {
  /** Writes (atomically replaces) the events of `matchId`; returns how many were written. */
  write(matchId: string, events: readonly unknown[]): Promise<number>;
  /** The stored events, or undefined when none are stored or the file is unreadable. */
  read(matchId: string): Promise<unknown[] | undefined>;
  remove(matchId: string): Promise<void>;
}

export const eventsKey = (matchId: string): string => {
  if (!MATCH_ID.test(matchId)) throw new Error("Invalid object key");
  return `${matchId}.events.json.gz`;
};
/** Match id of a stored events file name, or undefined for other names. */
export const eventsMatchId = (file: string): string | undefined =>
  /^([a-f0-9-]{36})\.events\.json\.gz$/.exec(file)?.[1];

/** Filesystem adapter with a small LRU of decoded arrays (keyed by job id and mtime). */
export class FileAnalysisEventsStore implements AnalysisEventsStore {
  private readonly cache = new Map<
    string,
    { mtimeMs: number; events: unknown[] }
  >();
  constructor(
    private readonly directory: string,
    private readonly cacheSize = 16,
  ) {}

  pathFor(matchId: string): string {
    return resolve(this.directory, eventsKey(matchId));
  }

  async write(matchId: string, events: readonly unknown[]): Promise<number> {
    const path = this.pathFor(matchId);
    const temp = resolve(this.directory, `.events-${randomUUID()}.tmp`);
    try {
      await writeFile(temp, await gzipAsync(JSON.stringify(events)), {
        mode: 0o600,
        flag: "wx",
      });
      await rename(temp, path);
    } catch (error) {
      await rm(temp, { force: true });
      throw error;
    }
    this.cache.delete(matchId);
    return events.length;
  }

  async read(matchId: string): Promise<unknown[] | undefined> {
    const path = this.pathFor(matchId);
    let mtimeMs: number;
    try {
      const info = await stat(path);
      if (!info.isFile()) return undefined;
      mtimeMs = info.mtimeMs;
    } catch {
      this.cache.delete(matchId);
      return undefined;
    }
    const hit = this.cache.get(matchId);
    if (hit && hit.mtimeMs === mtimeMs) {
      this.cache.delete(matchId);
      this.cache.set(matchId, hit);
      // A fresh array per reader: the cached one is never handed out for mutation.
      return [...hit.events];
    }
    try {
      const raw = await gunzipAsync(await readFile(path), {
        maxOutputLength: MAX_DECOMPRESSED,
      });
      const events: unknown = JSON.parse(raw.toString("utf8"));
      if (!Array.isArray(events)) return undefined;
      this.cache.set(matchId, { mtimeMs, events });
      while (this.cache.size > this.cacheSize)
        this.cache.delete(this.cache.keys().next().value!);
      return [...events];
    } catch {
      return undefined;
    }
  }

  async remove(matchId: string): Promise<void> {
    this.cache.delete(matchId);
    await rm(this.pathFor(matchId), { force: true });
  }
}
