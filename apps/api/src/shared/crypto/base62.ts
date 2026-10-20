import { randomBytes } from "node:crypto";

const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * `length` uniformly random base62 characters (rejection sampling: bytes >= 248 are dropped so
 * every character is equally likely). Used for API keys and webhook secrets.
 */
export function base62(length: number, random = randomBytes): string {
  let out = "";
  while (out.length < length) {
    for (const byte of random(length * 2)) {
      if (byte >= 248) continue;
      out += ALPHABET[byte % 62];
      if (out.length === length) break;
    }
  }
  return out;
}
