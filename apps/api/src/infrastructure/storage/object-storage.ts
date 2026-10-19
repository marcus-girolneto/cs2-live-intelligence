import { createWriteStream } from "node:fs";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { Transform, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";

const OBJECT_KEY = /^[a-f0-9-]{36}\.dem$/;

/** Thrown by `write` when the stream exceeds `maxBytes`; the partial object is removed. */
export class ObjectTooLargeError extends Error {
  constructor() {
    super("Object exceeds size limit");
  }
}
export interface StoredObject {
  size: number;
  /** SHA-256 hex of the content. */
  checksum: string;
}

/** Port: demo object storage (`<uuid>.dem` keys) plus raw directory housekeeping. */
export interface ObjectStorage {
  ensureReady(): Promise<void>;
  /** Streams `source` into a new object; never overwrites. */
  write(
    key: string,
    source: Readable,
    maxBytes?: number,
  ): Promise<StoredObject>;
  remove(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Every entry name in the storage directory (objects, replays, temp files). */
  entries(): Promise<string[]>;
  entryAgeMs(name: string): Promise<number>;
  removeEntry(name: string): Promise<void>;
}

export const isObjectKey = (key: string): boolean => OBJECT_KEY.test(key);

/** Absolute path of an object; rejects anything that is not a `<uuid>.dem` key. */
export function objectPath(directory: string, key: string): string {
  if (!OBJECT_KEY.test(key)) throw new Error("Invalid object key");
  return resolve(directory, key);
}

/** Filesystem adapter: one directory, private file modes. */
export class FsObjectStorage implements ObjectStorage {
  constructor(
    readonly directory: string,
    private readonly now: () => number = Date.now,
  ) {}
  path(key: string): string {
    return objectPath(this.directory, key);
  }
  async ensureReady(): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
  }
  async write(
    key: string,
    source: Readable,
    maxBytes = Infinity,
  ): Promise<StoredObject> {
    const path = this.path(key);
    const hash = createHash("sha256");
    let size = 0;
    try {
      await pipeline(
        source,
        new Transform({
          transform(chunk: Buffer, _encoding, callback) {
            size += chunk.length;
            if (size > maxBytes) {
              callback(new ObjectTooLargeError());
              return;
            }
            hash.update(chunk);
            callback(null, chunk);
          },
        }),
        createWriteStream(path, { flags: "wx", mode: 0o600 }),
      );
      return { size, checksum: hash.digest("hex") };
    } catch (error) {
      await rm(path, { force: true });
      throw error;
    }
  }
  async remove(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }
  async exists(key: string): Promise<boolean> {
    try {
      return (await stat(this.path(key))).isFile();
    } catch {
      return false;
    }
  }
  entries(): Promise<string[]> {
    return readdir(this.directory);
  }
  async entryAgeMs(name: string): Promise<number> {
    return this.now() - (await stat(resolve(this.directory, name))).mtimeMs;
  }
  async removeEntry(name: string): Promise<void> {
    await rm(resolve(this.directory, name), { force: true });
  }
}
