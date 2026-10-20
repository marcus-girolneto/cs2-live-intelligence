import { createHmac, timingSafeEqual } from "node:crypto";

/** Header carrying `t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<body>")>`. */
export const SIGNATURE_HEADER = "FragMind-Signature";
/** Receivers should reject signatures older than this (replay protection). */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export function signature(
  secret: string,
  timestamp: number,
  body: string,
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

/** The FragMind-Signature header value for `body` at `timestamp` (unix seconds). */
export function signatureHeader(
  secret: string,
  timestamp: number,
  body: string,
): string {
  return `t=${timestamp},v1=${signature(secret, timestamp, body)}`;
}

/**
 * Verifies a FragMind-Signature header (what a receiver does): the timestamp must be within
 * `toleranceSeconds` of `now` and one v1 value must match, compared in constant time.
 */
export function verifySignature(
  header: string,
  secret: string,
  body: string,
  now: number = Math.floor(Date.now() / 1000),
  toleranceSeconds = SIGNATURE_TOLERANCE_SECONDS,
): boolean {
  const parts = header.split(",").map((part) => part.trim().split("="));
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  if (!Number.isInteger(t) || Math.abs(now - t) > toleranceSeconds)
    return false;
  const expected = Buffer.from(signature(secret, t, body), "hex");
  return parts
    .filter(([k, v]) => k === "v1" && v && /^[0-9a-f]{64}$/.test(v))
    .some(([, v]) => timingSafeEqual(Buffer.from(v!, "hex"), expected));
}
