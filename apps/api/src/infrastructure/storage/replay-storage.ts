import { readFile, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { gunzip } from "node:zlib";
import {
  replayArtifactSchema,
  type ReplayArtifact,
} from "../../modules/replay/replay.dto.js";

const gunzipAsync = promisify(gunzip);
const JOB_ID = /^[a-f0-9-]{36}$/;
/** Decompressed artifacts above this size are rejected (guards against gzip bombs). */
// Long matches from 500 MB demos produce larger replays.
const MAX_DECOMPRESSED = 256 * 1024 * 1024;

/** Storage of per-job replay artifacts (`<jobId>.replay.json.gz`). */
export interface ReplayStorage {
  /** Absolute path the parser writes the artifact of `jobId` to. */
  pathFor(jobId: string): string;
  /** Decoded artifact, or undefined when none is stored or it is unreadable. */
  read(jobId: string): Promise<ReplayArtifact | undefined>;
  remove(jobId: string): Promise<void>;
}

export const replayKey = (jobId: string): string => {
  if (!JOB_ID.test(jobId)) throw new Error("Invalid object key");
  return `${jobId}.replay.json.gz`;
};
/** Job id of a stored replay file name, or undefined for other names. */
export const replayJobId = (file: string): string | undefined =>
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
  pathFor(jobId: string): string {
    return resolve(this.directory, replayKey(jobId));
  }
  async read(jobId: string): Promise<ReplayArtifact | undefined> {
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
      this.cache.set(jobId, { mtimeMs, replay: parsed.data });
      while (this.cache.size > this.cacheSize)
        this.cache.delete(this.cache.keys().next().value!);
      return parsed.data;
    } catch {
      return undefined;
    }
  }
  async remove(jobId: string): Promise<void> {
    this.cache.delete(jobId);
    await rm(this.pathFor(jobId), { force: true });
  }
}
