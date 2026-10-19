import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { RuntimeEnv } from "../../config/env.js";
/**
 * AES-256-GCM for secrets stored in Postgres (AI provider keys and headers).
 * Key: APP_ENCRYPTION_KEY (32 bytes as base64/base64url/hex, or any passphrase, which is
 * stretched with HKDF). Without it, a stable key is derived from WEB_TOKEN with a fixed salt
 * and a warning is logged once. Ciphertext format: "v1:" + base64url(iv | tag | data).
 */
const SALT = "cs2-live-intelligence/secrets/v1";
let warned = false;
const cache = new Map<string, Buffer>();
export class SecretKeyUnavailable extends Error {}
function material(raw: string): Buffer {
  const trimmed = raw.trim();
  if (/^[0-9a-f]{64}$/i.test(trimmed)) return Buffer.from(trimmed, "hex");
  if (/^[A-Za-z0-9+/_-]{43}=?$/.test(trimmed)) {
    const decoded = Buffer.from(
      trimmed.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    );
    if (decoded.length === 32) return decoded;
  }
  return Buffer.from(
    hkdfSync("sha256", trimmed, SALT, "app-encryption-key", 32),
  );
}
export function encryptionKey(
  env: Record<string, string | undefined> = new RuntimeEnv().raw(),
  warn: (message: string) => void = (m) => console.warn(m),
): Buffer {
  const explicit = env.APP_ENCRYPTION_KEY?.trim();
  const source = explicit
    ? `app:${explicit}`
    : env.WEB_TOKEN?.trim()
      ? `web:${env.WEB_TOKEN.trim()}`
      : "";
  if (!source)
    throw new SecretKeyUnavailable(
      "Set APP_ENCRYPTION_KEY to store provider credentials.",
    );
  const hit = cache.get(source);
  if (hit) return hit;
  if (!explicit && !warned) {
    warned = true;
    warn(
      "APP_ENCRYPTION_KEY is not set; deriving the secrets key from WEB_TOKEN. Set APP_ENCRYPTION_KEY (32 random bytes, base64) in production.",
    );
  }
  const key = explicit
    ? material(explicit)
    : Buffer.from(
        hkdfSync(
          "sha256",
          env.WEB_TOKEN!.trim(),
          SALT,
          "web-token-fallback",
          32,
        ),
      );
  if (cache.size > 8) cache.clear();
  cache.set(source, key);
  return key;
}
/** `context` (e.g. "provider:<id>:apiKey") is bound as associated data. */
export function encryptSecret(
  plaintext: string,
  context: string,
  key = encryptionKey(),
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(context));
  const data = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return (
    "v1:" + Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url")
  );
}
export function decryptSecret(
  ciphertext: string,
  context: string,
  key = encryptionKey(),
): string {
  if (!ciphertext.startsWith("v1:")) throw new Error("Unknown secret format");
  const raw = Buffer.from(ciphertext.slice(3), "base64url");
  if (raw.length < 28) throw new Error("Corrupt secret");
  const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([
    decipher.update(raw.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
}

/** Port: authenticated encryption of secrets at rest, bound to a context string. */
export interface SecretCipher {
  encrypt(plaintext: string, context: string): string;
  decrypt(ciphertext: string, context: string): string;
}

/**
 * AES-256-GCM adapter. The key is derived on every call so a changed APP_ENCRYPTION_KEY
 * takes effect immediately (and undecryptable rows are reported, not crashed on).
 */
export class AesGcmSecretCipher implements SecretCipher {
  constructor(
    private readonly env: () => Record<string, string | undefined> = () =>
      new RuntimeEnv().raw(),
  ) {}
  encrypt(plaintext: string, context: string): string {
    return encryptSecret(plaintext, context, encryptionKey(this.env()));
  }
  decrypt(ciphertext: string, context: string): string {
    return decryptSecret(ciphertext, context, encryptionKey(this.env()));
  }
}
