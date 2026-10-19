import { Transform, type TransformCallback } from "node:stream";

/**
 * Cheap pre-enqueue validation of an uploaded demo, done while it streams into storage: the
 * CS2 container magic, the two header offsets and the first frame header (it must be the
 * DEM_FileHeader command with a sane size), without running the parser. Obviously wrong files
 * are rejected before they are stored or queued; the sandboxed worker still validates every
 * frame before parsing.
 */
export const DEMO_MAGIC = Buffer.from("PBDEMS2\0", "binary");
/** Real CS2 demos are megabytes; anything below this is not a playable match. */
export const MIN_DEMO_BYTES = 64 * 1024;
/** Bytes needed to judge the header: magic + offsets + one frame header + payload prefix. */
const SNIFF_BYTES = 64;
const HEADER_BYTES = 16;
const DEM_FILE_HEADER = 1;
const DEM_IS_COMPRESSED = 64;
const MAX_FILE_HEADER_FRAME = 1024 * 1024;

export type DemoRejection = "not_cs2_demo" | "too_small";

/** Thrown by the sniffing stream (and `inspectDemoHeader` callers) for a non-demo body. */
export class DemoRejectedError extends Error {
  constructor(readonly reason: DemoRejection) {
    super(reason);
  }
}

function varint(
  buf: Buffer,
  offset: number,
): { value: number; next: number } | undefined {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const byte = buf[offset + i];
    if (byte === undefined) return undefined;
    value += (byte & 0x7f) * 2 ** (7 * i);
    if (!(byte & 0x80)) return { value, next: offset + i + 1 };
  }
  return undefined;
}

/**
 * Judges the first bytes of a demo. `complete` says whether `head` is the whole file (then a
 * short head is final). Returns undefined when the header looks like a CS2 demo.
 */
export function inspectDemoHeader(
  head: Buffer,
  complete: boolean,
): DemoRejection | undefined {
  if (head.length < DEMO_MAGIC.length)
    return complete && head.length > 0 ? "not_cs2_demo" : undefined;
  if (!head.subarray(0, DEMO_MAGIC.length).equals(DEMO_MAGIC))
    return "not_cs2_demo";
  if (head.length < SNIFF_BYTES) return complete ? "too_small" : undefined;
  const cmd = varint(head, HEADER_BYTES);
  const tick = cmd && varint(head, cmd.next);
  const size = tick && varint(head, tick.next);
  if (!cmd || !tick || !size) return "not_cs2_demo";
  if ((cmd.value & ~DEM_IS_COMPRESSED) !== DEM_FILE_HEADER)
    return "not_cs2_demo";
  if (size.value < 1 || size.value > MAX_FILE_HEADER_FRAME)
    return "not_cs2_demo";
  // An uncompressed CDemoFileHeader starts with field 1 (demo_file_stamp, length-delimited).
  if (!(cmd.value & DEM_IS_COMPRESSED) && head[size.next] !== 0x0a)
    return "not_cs2_demo";
  return undefined;
}

/**
 * Pass-through stream that fails with DemoRejectedError as soon as the first bytes are not a
 * CS2 demo (so a 500 MB non-demo is not written to disk), and at the end when the body is
 * shorter than MIN_DEMO_BYTES.
 */
export function demoSniffer(minBytes = MIN_DEMO_BYTES): Transform {
  let head: Buffer = Buffer.alloc(0);
  let judged = false;
  let total = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback: TransformCallback) {
      total += chunk.length;
      if (!judged) {
        head = Buffer.concat([head, chunk]).subarray(0, SNIFF_BYTES);
        const rejection = inspectDemoHeader(head, false);
        if (rejection) return callback(new DemoRejectedError(rejection));
        if (head.length >= SNIFF_BYTES) judged = true;
      }
      callback(null, chunk);
    },
    flush(callback: TransformCallback) {
      if (total === 0) return callback();
      const rejection = judged ? undefined : inspectDemoHeader(head, true);
      if (rejection) return callback(new DemoRejectedError(rejection));
      if (total < minBytes) return callback(new DemoRejectedError("too_small"));
      callback();
    },
  });
}
