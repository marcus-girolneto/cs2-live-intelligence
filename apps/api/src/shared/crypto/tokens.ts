import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** SHA-256 hex digest; credentials are stored only as digests. */
export const digest = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

/** 256-bit random token (base64url). */
export const secret = (): string => randomBytes(32).toString("base64url");

/** Constant-time string comparison (false on length mismatch). */
export function constantTimeEqual(a: string, b: string): boolean {
  const first = Buffer.from(a);
  const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}
