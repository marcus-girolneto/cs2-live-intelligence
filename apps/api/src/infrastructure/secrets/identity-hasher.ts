import { createHmac, hkdfSync } from "node:crypto";
import { encryptionKey } from "./aes-gcm-secret-cipher.js";

/**
 * Port: keyed one-way hashes of identifiers that must be remembered without being stored
 * (Steam ids of welcome grants that outlive account deletion, sign-in network prefixes).
 */
export interface IdentityHasher {
  /** Hex HMAC-SHA256 of `value` in a domain ("steam", "net"); undefined when no key is set. */
  hash(domain: string, value: string): string | undefined;
}

/**
 * HMAC-SHA256 keyed by a secret derived (HKDF) from APP_ENCRYPTION_KEY (or the WEB_TOKEN
 * fallback of the secrets cipher). Changing the key makes earlier hashes unmatchable, which
 * would re-open welcome grants, so the key must be stable in production.
 */
export class HmacIdentityHasher implements IdentityHasher {
  constructor(private readonly env: () => Record<string, string | undefined>) {}
  hash(domain: string, value: string): string | undefined {
    let key: Buffer;
    try {
      key = encryptionKey(this.env(), () => undefined);
    } catch {
      return undefined;
    }
    const secret = Buffer.from(
      hkdfSync(
        "sha256",
        key,
        "cs2-live-intelligence/identity",
        "identity-hmac/v1",
        32,
      ),
    );
    return createHmac("sha256", secret)
      .update(`${domain}:${value}`)
      .digest("hex");
  }
}
