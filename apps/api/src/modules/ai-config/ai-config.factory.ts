import {
  loadAiConfig,
  PURPOSE_LIMITS,
  type AiConfigResult,
} from "@cs2/coaching";
import type { RuntimeEnv } from "../../config/env.js";
import type { SecretCipher } from "../../infrastructure/secrets/aes-gcm-secret-cipher.js";
import {
  providerOptionsSchema,
  type AiPurpose,
  type AppSettings,
  type AssignmentOptions,
  type ProviderOptions,
} from "./ai-config.dto.js";
import type { AiProviderRecord } from "./ai-config.repository.js";

/** A provider profile with its secrets decrypted (never persisted or returned). */
export type PlainProvider = {
  provider: string;
  baseUrl: string | null;
  apiKey?: string;
  headersJson?: string;
  options: Record<string, unknown>;
};

export const UNDECRYPTABLE =
  "The stored provider credentials cannot be decrypted (was APP_ENCRYPTION_KEY changed?). Re-enter the API key.";

/**
 * Factory for AiConfig: every config (admin-stored provider or AI_* environment) is built
 * through @cs2/coaching's loadAiConfig from a synthetic env, so validation lives in one place.
 */
export class AiConfigFactory {
  constructor(
    private readonly cipher: SecretCipher,
    private readonly env: RuntimeEnv,
  ) {}

  /** Decrypts a stored provider's secrets; throws when they cannot be decrypted. */
  decrypt(row: AiProviderRecord): PlainProvider {
    return {
      provider: row.provider,
      baseUrl: row.baseUrl,
      ...(row.apiKeyEnc
        ? {
            apiKey: this.cipher.decrypt(
              row.apiKeyEnc,
              `ai_provider:${row.id}:apiKey`,
            ),
          }
        : {}),
      ...(row.headersEnc
        ? {
            headersJson: this.cipher.decrypt(
              row.headersEnc,
              `ai_provider:${row.id}:headers`,
            ),
          }
        : {}),
      options: row.options,
    };
  }

  /** Synthetic AI_* env for a provider profile + model (secrets already decrypted). */
  providerEnv(
    p: PlainProvider,
    model: string,
    settings: AppSettings,
    purpose?: AiPurpose,
    assignment: AssignmentOptions = {},
  ): Record<string, string | undefined> {
    const parsed = providerOptionsSchema.safeParse(p.options);
    const o: ProviderOptions = parsed.success ? parsed.data : {};
    // Output budget: assignment, then provider profile, then the purpose's built-in default.
    const maxOutputTokens =
      assignment.maxOutputTokens ??
      o.maxOutputTokens ??
      (purpose ? PURPOSE_LIMITS[purpose].maxOutputTokens : undefined);
    const extraBody = withReasoning(
      o.extraBody ?? {},
      assignment.reasoningEffort,
      p.provider,
      o.apiStyle,
    );
    return {
      AI_PROVIDER: p.provider,
      AI_BASE_URL: p.baseUrl ?? undefined,
      AI_API_KEY: p.apiKey,
      AI_MODEL: model,
      AI_API_STYLE: o.apiStyle,
      AI_JSON_MODE: o.jsonMode,
      AI_MAX_TOKENS_PARAM: o.maxTokensParam,
      AI_MAX_OUTPUT_TOKENS: maxOutputTokens?.toString(),
      AI_TIMEOUT_MS: o.timeoutMs?.toString(),
      AI_MAX_ATTEMPTS: o.maxAttempts?.toString(),
      AI_TEMPERATURE:
        o.temperature === null || o.temperature === undefined
          ? undefined
          : String(o.temperature),
      AI_HEADERS: p.headersJson,
      AI_EXTRA_BODY: Object.keys(extraBody).length
        ? JSON.stringify(extraBody)
        : undefined,
      AI_ALLOW_HTTP: o.allowHttp ? "true" : undefined,
      ...this.limits(settings),
    };
  }

  /** Admin settings override the AI_DAILY_LIMIT / AI_MAX_INPUT_BYTES environment defaults. */
  limits(settings: AppSettings): Record<string, string | undefined> {
    return {
      AI_DAILY_LIMIT:
        settings.dailyLimit !== null
          ? String(settings.dailyLimit)
          : this.env.aiDailyLimit(),
      AI_MAX_INPUT_BYTES:
        settings.maxInputBytes !== null
          ? String(settings.maxInputBytes)
          : this.env.aiMaxInputBytes(),
    };
  }

  /** Config of a stored provider + model; a decryption failure becomes a not-ok result. */
  fromProvider(
    row: AiProviderRecord,
    model: string,
    settings: AppSettings,
    purpose?: AiPurpose,
    assignment: AssignmentOptions = {},
  ): AiConfigResult {
    try {
      return loadAiConfig(
        this.providerEnv(
          this.decrypt(row),
          model,
          settings,
          purpose,
          assignment,
        ),
      );
    } catch {
      return { ok: false, reason: UNDECRYPTABLE, missing: [] };
    }
  }

  /** Config from the AI_* environment (fallback when a purpose has no assignment). */
  fromEnvironment(settings: AppSettings, purpose?: AiPurpose): AiConfigResult {
    const env = this.env.aiFallback();
    return loadAiConfig({
      ...env,
      ...(purpose && !env.AI_MAX_OUTPUT_TOKENS?.trim()
        ? {
            AI_MAX_OUTPUT_TOKENS: String(
              PURPOSE_LIMITS[purpose].maxOutputTokens,
            ),
          }
        : {}),
      ...this.limits(settings),
    });
  }

  /** Validates a profile's shape (placeholder model/key: only the shape matters). */
  validate(plain: PlainProvider, settings: AppSettings): AiConfigResult {
    return loadAiConfig(
      this.providerEnv(
        { ...plain, apiKey: plain.apiKey ?? "validation-placeholder" },
        "validation-model",
        settings,
      ),
    );
  }
}

/**
 * Adds the assignment's reasoning effort to the request extras in the provider's dialect:
 * OpenAI chat uses "reasoning_effort"; the Responses API and OpenRouter use
 * {"reasoning": {"effort"}}. Without an effort the profile's extras are unchanged.
 */
export function withReasoning(
  extraBody: Record<string, unknown>,
  effort: AssignmentOptions["reasoningEffort"],
  provider: string,
  apiStyle: ProviderOptions["apiStyle"],
): Record<string, unknown> {
  if (!effort) return extraBody;
  if (provider === "openai" && apiStyle !== "responses")
    return { ...extraBody, reasoning_effort: effort };
  const current =
    typeof extraBody.reasoning === "object" && extraBody.reasoning !== null
      ? (extraBody.reasoning as Record<string, unknown>)
      : {};
  return { ...extraBody, reasoning: { ...current, effort } };
}
