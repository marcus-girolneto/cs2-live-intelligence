import { randomUUID } from "node:crypto";
import { link, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const JOB_ID = /^[a-f0-9-]{36}$/;
/** Decoded events above this size are rejected (gzip bomb guard; ~1 MB per real match). */
const MAX_DECOMPRESSED = 256 * 1024 * 1024;

/**
 * Port: the bulky `events` array of an analysis (shots, damage, grenades… about 1 MB per match),
 * kept in object storage as `<jobId>.events.json.gz` next to the replay instead of Postgres.
 */
export interface AnalysisEventsStore {
  /** Writes (atomically replaces) the events of `jobId`; returns how many were written. */
  write(jobId: string, events: readonly unknown[]): Promise<number>;
  /** The stored events, or undefined when none are stored or the file is unreadable. */
  read(jobId: string): Promise<unknown[] | undefined>;
  /** Gives `to` its own directory entry for the events of `from` (hard link, else a copy). */
  copy(from: string, to: string): Promise<boolean>;
  remove(jobId: string): Promise<void>;
}

export const eventsKey = (jobId: string): string => {
  if (!JOB_ID.test(jobId)) throw new Error("Invalid object key");
  return `${jobId}.events.json.gz`;
};
/** Job id of a stored events file name, or undefined for other names. */
export const eventsJobId = (file: string): string | undefined =>
  /^([a-f0-9-]{36})\.events\.json\.gz$/.exec(file)?.[1];

/**
 * Atomically gives `target` the content of `source`: hard link (no extra space; deleting one
 * name never affects the other) or copy, to a temp name, then rename over the target.
 */
export async function linkOrCopy(
  directory: string,
  source: string,
  target: string,
): Promise<boolean> {
  const from = resolve(directory, source);
  try {
    if (!(await stat(from)).isFile()) return false;
  } catch {
    return false;
  }
  const temp = resolve(directory, `.link-${randomUUID()}.tmp`);
  try {
    await link(from, temp).catch(async () =>
      writeFile(temp, await readFile(from), { mode: 0o600 }),
    );
    await rename(temp, resolve(directory, target));
    return true;
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}

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

  pathFor(jobId: string): string {
    return resolve(this.directory, eventsKey(jobId));
  }

  async write(jobId: string, events: readonly unknown[]): Promise<number> {
    const path = this.pathFor(jobId);
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
    this.cache.delete(jobId);
    return events.length;
  }

  async read(jobId: string): Promise<unknown[] | undefined> {
    const path = this.pathFor(jobId);
    let mtimeMs: number;
    try {
      const info = await stat(path);
      if (!info.isFile()) return undefined;
      mtimeMs = info.mtimeMs;
    } catch {
      this.cache.delete(jobId);
      return undefined;
    }
    const hit = this.cache.get(jobId);
    if (hit && hit.mtimeMs === mtimeMs) {
      this.cache.delete(jobId);
      this.cache.set(jobId, hit);
      // A fresh array per reader: the cached one is never handed out for mutation.
      return [...hit.events];
    }
    try {
      const raw = await gunzipAsync(await readFile(path), {
        maxOutputLength: MAX_DECOMPRESSED,
      });
      const events: unknown = JSON.parse(raw.toString("utf8"));
      if (!Array.isArray(events)) return undefined;
      this.cache.set(jobId, { mtimeMs, events });
      while (this.cache.size > this.cacheSize)
        this.cache.delete(this.cache.keys().next().value!);
      return [...events];
    } catch {
      return undefined;
    }
  }

  async copy(from: string, to: string): Promise<boolean> {
    this.cache.delete(to);
    return linkOrCopy(this.directory, eventsKey(from), eventsKey(to));
  }

  async remove(jobId: string): Promise<void> {
    this.cache.delete(jobId);
    await rm(this.pathFor(jobId), { force: true });
  }
}
