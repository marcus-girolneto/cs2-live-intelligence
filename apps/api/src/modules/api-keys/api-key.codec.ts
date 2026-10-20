import { randomBytes } from "node:crypto";
import { base62 } from "../../shared/crypto/base62.js";

/** `fm_live_` + 32 base62 characters (about 190 bits of entropy). */
export const KEY_PREFIX = "fm_live_";
export const KEY_PATTERN = /^fm_live_[0-9A-Za-z]{32}$/;
/** A new API key. */
export function newApiKey(random = randomBytes): string {
  return KEY_PREFIX + base62(32, random);
}

/** The displayable part of a key: `fm_live_` plus its first 4 random characters. */
export function keyPrefix(key: string): string {
  return key.slice(0, KEY_PREFIX.length + 4);
}

/** True when `value` has the shape of an API key (checked before any lookup). */
export function looksLikeApiKey(value: string): boolean {
  return KEY_PATTERN.test(value);
}

/** Port: one-way keyed hash of API keys (only the hash is stored). */
export interface ApiKeyHasher {
  hash(key: string): string;
}
