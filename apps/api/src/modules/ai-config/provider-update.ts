import type { SecretCipher } from "../../infrastructure/secrets/aes-gcm-secret-cipher.js";
import { SecretKeyUnavailable } from "../../infrastructure/secrets/aes-gcm-secret-cipher.js";
import { ConflictError } from "../../shared/errors/index.js";
import {
  PROVIDER_OPTION_KEYS,
  type UpdateProviderDto,
} from "./ai-config.dto.js";
import type { AiConfigFactory, PlainProvider } from "./ai-config.factory.js";
import type { AiProviderRecord } from "./ai-config.repository.js";
import { secretFailure } from "./ai-errors.js";

/** Options after a partial update: undefined/null clears a key, other values replace it. */
function mergedOptions(
  row: AiProviderRecord,
  body: UpdateProviderDto,
): Record<string, unknown> {
  const options: Record<string, unknown> = { ...row.options };
  for (const key of PROVIDER_OPTION_KEYS)
    if (key in body) {
      const value = (body as Record<string, unknown>)[key];
      if (value === undefined || value === null) delete options[key];
      else options[key] = value;
    }
  return options;
}

/** Current secrets; undecryptable ones must be re-entered (or explicitly cleared). */
function currentSecrets(
  row: AiProviderRecord,
  body: UpdateProviderDto,
  factory: AiConfigFactory,
): Pick<PlainProvider, "apiKey" | "headersJson"> {
  try {
    return factory.decrypt(row);
  } catch (error) {
    if (error instanceof SecretKeyUnavailable) secretFailure(error);
    if (body.apiKey === undefined && row.apiKeyEnc)
      throw new ConflictError(
        "The stored API key cannot be decrypted (APP_ENCRYPTION_KEY changed?). Send a new apiKey.",
      );
    return {};
  }
}

/**
 * The provider after PUT /v1/admin/ai/providers/:id: `plain` (for validation) and a lazy
 * `record()` that re-encrypts only the secrets the request changed.
 */
export function nextProviderRecord(
  row: AiProviderRecord,
  body: UpdateProviderDto,
  factory: AiConfigFactory,
  cipher: SecretCipher,
  last4: (key: string) => string | null,
): {
  plain: PlainProvider;
  record: () => Omit<AiProviderRecord, "createdAt" | "updatedAt">;
} {
  const options = mergedOptions(row, body);
  const current = currentSecrets(row, body, factory);
  const apiKey =
    body.apiKey === undefined ? current.apiKey : (body.apiKey ?? undefined);
  const headersJson =
    body.headers === undefined
      ? current.headersJson
      : body.headers && Object.keys(body.headers).length
        ? JSON.stringify(body.headers)
        : undefined;
  const plain: PlainProvider = {
    provider: body.provider ?? row.provider,
    baseUrl: body.baseUrl === undefined ? row.baseUrl : body.baseUrl,
    apiKey,
    headersJson,
    options,
  };
  const record = (): Omit<AiProviderRecord, "createdAt" | "updatedAt"> => ({
    id: row.id,
    name: body.name ?? row.name,
    provider: plain.provider,
    baseUrl: plain.baseUrl,
    apiKeyEnc: apiKey
      ? body.apiKey === undefined
        ? row.apiKeyEnc
        : cipher.encrypt(apiKey, `ai_provider:${row.id}:apiKey`)
      : null,
    keyLast4: apiKey
      ? body.apiKey === undefined
        ? row.keyLast4
        : last4(apiKey)
      : null,
    headersEnc: headersJson
      ? body.headers === undefined
        ? row.headersEnc
        : cipher.encrypt(headersJson, `ai_provider:${row.id}:headers`)
      : null,
    headerNames: !headersJson
      ? []
      : body.headers === undefined
        ? row.headerNames
        : Object.keys(body.headers ?? {}),
    options,
  });
  return { plain, record };
}
