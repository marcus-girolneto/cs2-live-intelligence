import { randomUUID } from "node:crypto";
import { readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const MATCH_ID = /^[a-f0-9-]{36}$/;
/** Decoded documents above this size are rejected (gzip bomb guard; ~1 MB per real match). */
const MAX_DECOMPRESSED = 128 * 1024 * 1024;

/**
 * Port: the full analysis document of a match (players, evidence, integrity… without the
 * `events`, which have their own file), stored once per match as `<matchId>.analysis.json.gz`.
 */
export interface AnalysisStore {
  /** Writes (atomically replaces) the document of `matchId`. */
  write(matchId: string, analysis: unknown): Promise<void>;
  /** The stored document, or undefined when none is stored or the file is unreadable. */
  read(matchId: string): Promise<Record<string, unknown> | undefined>;
  remove(matchId: string): Promise<void>;
}

export const analysisKey = (matchId: string): string => {
  if (!MATCH_ID.test(matchId)) throw new Error("Invalid object key");
  return `${matchId}.analysis.json.gz`;
};
/** Match id of a stored analysis file name, or undefined for other names. */
export const analysisMatchId = (file: string): string | undefined =>
  /^([a-f0-9-]{36})\.analysis\.json\.gz$/.exec(file)?.[1];

/**
 * Filesystem adapter with an LRU of decoded documents (keyed by match id and mtime). Readers
 * get a shallow copy, so the cached document is never mutated through a reader.
 */
export class FileAnalysisStore implements AnalysisStore {
  private readonly cache = new Map<
    string,
    { mtimeMs: number; doc: Record<string, unknown> }
  >();
  constructor(
    private readonly directory: string,
    private readonly cacheSize = 64,
  ) {}

  pathFor(matchId: string): string {
    return resolve(this.directory, analysisKey(matchId));
  }

  async write(matchId: string, analysis: unknown): Promise<void> {
    const path = this.pathFor(matchId);
    const temp = resolve(this.directory, `.analysis-${randomUUID()}.tmp`);
    try {
      await writeFile(temp, await gzipAsync(JSON.stringify(analysis)), {
        mode: 0o600,
        flag: "wx",
      });
      await rename(temp, path);
    } catch (error) {
      await rm(temp, { force: true });
      throw error;
    }
    this.cache.delete(matchId);
  }

  async read(matchId: string): Promise<Record<string, unknown> | undefined> {
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
      return { ...hit.doc };
    }
    try {
      const raw = await gunzipAsync(await readFile(path), {
        maxOutputLength: MAX_DECOMPRESSED,
      });
      const doc: unknown = JSON.parse(raw.toString("utf8"));
      if (!doc || typeof doc !== "object" || Array.isArray(doc))
        return undefined;
      const record = doc as Record<string, unknown>;
      this.cache.set(matchId, { mtimeMs, doc: record });
      while (this.cache.size > this.cacheSize)
        this.cache.delete(this.cache.keys().next().value!);
      return { ...record };
    } catch {
      return undefined;
    }
  }

  async remove(matchId: string): Promise<void> {
    this.cache.delete(matchId);
    await rm(this.pathFor(matchId), { force: true });
  }
}
