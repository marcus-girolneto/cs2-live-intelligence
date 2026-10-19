import { MIN_DEMO_BYTES } from "../../src/modules/matches/demo-signature.js";
import {
  UPLOAD_RATE,
  type UploadRate,
} from "../../src/modules/matches/upload-rate-limit.js";

/** Integration suites upload far more than 10 demos a minute from one address. */
export const LENIENT_UPLOAD_RATE: UploadRate = {
  ...UPLOAD_RATE,
  perAccount: 10_000,
  perNetwork: 10_000,
};

/**
 * A body that passes the upload's cheap CS2 header validation (magic, offsets, a
 * DEM_FileHeader first frame) but is not a parseable match: integration tests use it wherever
 * the old tests uploaded arbitrary bytes. `tag` makes the checksum unique.
 */
export function demoBytes(tag: string, size = MIN_DEMO_BYTES): Buffer {
  const stamp = Buffer.from("PBDEMS2\0", "binary");
  const payload = Buffer.concat([Buffer.from([0x0a, 0x08]), stamp]);
  const head = Buffer.concat([
    stamp,
    Buffer.alloc(8),
    Buffer.from([1, 0xff, 0xff, 0xff, 0xff, 0x0f, payload.length]),
    payload,
    Buffer.from(tag, "utf8"),
  ]);
  return Buffer.concat([head, Buffer.alloc(Math.max(0, size - head.length))]);
}
