import { readFile, rename, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { gunzip } from "node:zlib";
import {
  replayArtifactSchema,
  type ReplayArtifact,
} from "../../modules/replay/replay.dto.js";

const gunzipAsync = promisify(gunzip);
const MATCH_ID = /^[a-f0-9-]{36}$/;
/** Decompressed artifacts above this size are rejected (guards against gzip bombs). */
// Long matches from 500 MB demos produce larger replays.
const MAX_DECOMPRESSED = 256 * 1024 * 1024;

/** Storage of per-match replay artifacts (`<matchId>.replay.json.gz`). */
export interface ReplayStorage {
  /** Absolute path the parser writes the artifact of `matchId` to. */
  pathFor(matchId: string): string;
  /** Decoded artifact, or undefined when none is stored or it is unreadable. */
  read(matchId: string): Promise<ReplayArtifact | undefined>;
  remove(matchId: string): Promise<void>;
  /** Renames the artifact of `from` to `to` (false when `from` has none). */
  move(from: string, to: string): Promise<boolean>;
}

export const replayKey = (matchId: string): string => {
  if (!MATCH_ID.test(matchId)) throw new Error("Invalid object key");
  return `${matchId}.replay.json.gz`;
};
/** Match id of a stored replay file name, or undefined for other names. */
export const replayMatchId = (file: string): string | undefined =>
  /^([a-f0-9-]{36})\.replay\.json\.gz$/.exec(file)?.[1];

/** Filesystem adapter next to the uploaded .dem objects, with a small decoded-artifact LRU. */
export class FileReplayStorage implements ReplayStorage {
  private readonly cache = new Map<
    string,
    { mtimeMs: number; replay: ReplayArtifact }
  >();
  constructor(
    private readonly directory: string,
    private readonly cacheSize = 4,
  ) {}
  pathFor(matchId: string): string {
    return resolve(this.directory, replayKey(matchId));
  }
  async read(matchId: string): Promise<ReplayArtifact | undefined> {
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
      return hit.replay;
    }
    try {
      const raw = await gunzipAsync(await readFile(path), {
        maxOutputLength: MAX_DECOMPRESSED,
      });
      const parsed = replayArtifactSchema.safeParse(
        JSON.parse(raw.toString("utf8")),
      );
      if (!parsed.success) return undefined;
      this.cache.set(matchId, { mtimeMs, replay: parsed.data });
      while (this.cache.size > this.cacheSize)
        this.cache.delete(this.cache.keys().next().value!);
      return parsed.data;
    } catch {
      return undefined;
    }
  }
  async move(from: string, to: string): Promise<boolean> {
    this.cache.delete(from);
    this.cache.delete(to);
    try {
      await rename(this.pathFor(from), this.pathFor(to));
      return true;
    } catch {
      return false;
    }
  }
  async remove(matchId: string): Promise<void> {
    this.cache.delete(matchId);
    await rm(this.pathFor(matchId), { force: true });
  }
}
