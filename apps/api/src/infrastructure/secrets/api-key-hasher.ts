import { createHmac, hkdfSync } from "node:crypto";
import { ServiceUnavailableError } from "../../shared/errors/index.js";
import { encryptionKey } from "./aes-gcm-secret-cipher.js";
import type { ApiKeyHasher } from "../../modules/api-keys/api-key.codec.js";

/**
 * HMAC-SHA256 of an API key with a server pepper derived (HKDF) from APP_ENCRYPTION_KEY (or the
 * WEB_TOKEN fallback of the secrets cipher in local development). A leaked `api_keys` table
 * cannot be brute-forced or replayed without the server key. Changing the key invalidates every
 * API key, so it must be stable in production.
 */
export class HmacApiKeyHasher implements ApiKeyHasher {
  constructor(private readonly env: () => Record<string, string | undefined>) {}

  private pepper(): Buffer {
    let key: Buffer;
    try {
      key = encryptionKey(this.env(), () => undefined);
    } catch {
      throw new ServiceUnavailableError(
        "API keys need APP_ENCRYPTION_KEY on the server.",
        { code: "api_keys_unavailable" },
      );
    }
    return Buffer.from(
      hkdfSync(
        "sha256",
        key,
        "cs2-live-intelligence/api-keys",
        "api-key-pepper/v1",
        32,
      ),
    );
  }

  hash(key: string): string {
    return createHmac("sha256", this.pepper()).update(key).digest("hex");
  }
}
