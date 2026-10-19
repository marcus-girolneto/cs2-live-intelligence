/**
 * Provider-agnostic language-model client. Everything about the provider comes from
 * configuration: base URL, model, API style, structured-output mode, headers and
 * extra body fields. Works with OpenAI, OpenRouter, Ollama and any OpenAI-compatible API.
 */
export type ApiStyle = "chat" | "responses";
export type JsonMode = "json_schema" | "json_object" | "prompt";
export type AiConfig = {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  apiStyle: ApiStyle;
  jsonMode: JsonMode;
  maxTokensParam: string;
  maxOutputTokens: number;
  timeoutMs: number;
  maxAttempts: number;
  temperature?: number;
  headers: Record<string, string>;
  extraBody: Record<string, unknown>;
  dailyLimit: number | null;
  maxInputBytes: number;
};
export type AiConfigResult =
  | { ok: true; config: AiConfig }
  | { ok: false; reason: string; missing: string[] };

/** Known endpoints so a provider name alone is enough; AI_BASE_URL always wins. */
export const PROVIDER_PRESETS: Record<
  string,
  { baseUrl: string; maxTokensParam?: string; keyOptional?: boolean }
> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    maxTokensParam: "max_completion_tokens",
  },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1" },
  ollama: { baseUrl: "http://127.0.0.1:11434/v1", keyOptional: true },
};

type Env = Record<string, string | undefined>;
const int = (
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) => {
  if (value === undefined || value.trim() === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max)
    throw new Error(`must be an integer between ${min} and ${max}`);
  return n;
};
const json = (value: string | undefined, name: string) => {
  if (!value?.trim()) return {};
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    throw new Error(`${name} must be a JSON object`);
  return parsed as Record<string, unknown>;
};
const isLoopback = (host: string) =>
  host === "localhost" ||
  host === "127.0.0.1" ||
  host === "::1" ||
  host === "[::1]";

/** Reads AI_* variables (and legacy OPENAI_* ones). Never throws; reports what is missing. */
export function loadAiConfig(rawEnv: Env): AiConfigResult {
  // Compose passes unset variables as empty strings; treat them as unset.
  const env: Env = Object.fromEntries(
    Object.entries(rawEnv).map(([k, v]) => [k, v?.trim() ? v : undefined]),
  );
  const legacy =
    !env.AI_MODEL &&
    !env.AI_PROVIDER &&
    !env.AI_BASE_URL &&
    !!env.OPENAI_API_KEY;
  const provider = (env.AI_PROVIDER ?? (legacy ? "openai" : ""))
    .trim()
    .toLowerCase();
  const preset = PROVIDER_PRESETS[provider];
  const baseUrl = (env.AI_BASE_URL ?? preset?.baseUrl ?? "")
    .trim()
    .replace(/\/+$/, "");
  const apiKey = (
    env.AI_API_KEY ??
    (legacy ? env.OPENAI_API_KEY : "") ??
    ""
  ).trim();
  const model = (env.AI_MODEL ?? (legacy ? env.OPENAI_MODEL : "") ?? "").trim();
  const missing: string[] = [];
  if (!baseUrl)
    missing.push(provider ? "AI_BASE_URL" : "AI_PROVIDER or AI_BASE_URL");
  if (!model) missing.push("AI_MODEL");
  try {
    const headers = json(env.AI_HEADERS, "AI_HEADERS");
    for (const [k, v] of Object.entries(headers))
      if (typeof v !== "string" || /[\r\n]/.test(v) || /[\r\n:]/.test(k))
        throw new Error("AI_HEADERS values must be single-line strings");
    if (baseUrl) {
      const url = new URL(baseUrl);
      const local = isLoopback(url.hostname);
      if (
        url.protocol !== "https:" &&
        !(url.protocol === "http:" && (local || env.AI_ALLOW_HTTP === "true"))
      )
        throw new Error(
          "AI_BASE_URL must use HTTPS (HTTP only for loopback or with AI_ALLOW_HTTP=true)",
        );
      if (url.username || url.password)
        throw new Error("AI_BASE_URL must not contain credentials");
      if (
        !apiKey &&
        !preset?.keyOptional &&
        !local &&
        !Object.keys(headers).length
      )
        missing.push("AI_API_KEY");
    }
    if (missing.length)
      return {
        ok: false,
        reason: `AI provider is not configured: set ${missing.join(", ")}.`,
        missing,
      };
    const apiStyle = (
      env.AI_API_STYLE ?? (legacy ? "responses" : "chat")
    ).trim() as ApiStyle;
    if (apiStyle !== "chat" && apiStyle !== "responses")
      throw new Error("AI_API_STYLE must be chat or responses");
    const jsonMode = (env.AI_JSON_MODE ?? "json_schema").trim() as JsonMode;
    if (!["json_schema", "json_object", "prompt"].includes(jsonMode))
      throw new Error(
        "AI_JSON_MODE must be json_schema, json_object or prompt",
      );
    const temperature = env.AI_TEMPERATURE?.trim()
      ? Number(env.AI_TEMPERATURE)
      : undefined;
    if (
      temperature !== undefined &&
      (!Number.isFinite(temperature) || temperature < 0 || temperature > 2)
    )
      throw new Error("AI_TEMPERATURE must be between 0 and 2");
    const limit = int(env.AI_DAILY_LIMIT, 0, 0, 1_000_000);
    return {
      ok: true,
      config: {
        provider: provider || new URL(baseUrl).hostname,
        baseUrl,
        apiKey,
        model,
        apiStyle,
        jsonMode,
        maxTokensParam: (
          env.AI_MAX_TOKENS_PARAM ??
          preset?.maxTokensParam ??
          "max_tokens"
        ).trim(),
        maxOutputTokens: int(env.AI_MAX_OUTPUT_TOKENS, 4096, 64, 200_000),
        timeoutMs: int(env.AI_TIMEOUT_MS, 90_000, 1_000, 600_000),
        maxAttempts: int(env.AI_MAX_ATTEMPTS, 2, 1, 5),
        ...(temperature !== undefined ? { temperature } : {}),
        headers: headers as Record<string, string>,
        extraBody: json(env.AI_EXTRA_BODY, "AI_EXTRA_BODY"),
        dailyLimit: limit === 0 ? null : limit,
        maxInputBytes: int(env.AI_MAX_INPUT_BYTES, 200_000, 1_000, 5_000_000),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid value";
    return {
      ok: false,
      reason: `AI provider configuration is invalid: ${message}`,
      missing: [],
    };
  }
}

export type AiErrorCode =
  | "http"
  | "timeout"
  | "network"
  | "truncated"
  | "refused"
  | "invalid_output"
  | "input_too_large"
  | "between_rounds_only";
export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
export type ModelCall = {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
};
export type ModelResult = {
  data: unknown;
  model: string;
  provider: string;
  latencyMs: number;
  attempts: number;
  usage?: { inputTokens?: number; outputTokens?: number };
};

/** Extracts a JSON object from model text, tolerating code fences and surrounding prose. */
export function parseModelJson(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new AiError("invalid_output", "The model did not return valid JSON.");
  }
}

const redact = (text: string, secret: string) =>
  secret ? text.split(secret).join("[redacted]") : text;

function requestBody(config: AiConfig, call: ModelCall) {
  const schemaHint = `Respond with a single JSON object that matches this JSON Schema exactly, with no other text:\n${JSON.stringify(call.schema)}`;
  const system =
    config.jsonMode === "json_schema"
      ? call.system
      : `${call.system}\n\n${schemaHint}`;
  if (config.apiStyle === "responses")
    return {
      model: config.model,
      store: false,
      max_output_tokens: config.maxOutputTokens,
      input: [
        { role: "system", content: system },
        { role: "user", content: call.user },
      ],
      ...(config.jsonMode === "json_schema"
        ? {
            text: {
              format: {
                type: "json_schema",
                name: call.schemaName,
                strict: true,
                schema: call.schema,
              },
            },
          }
        : config.jsonMode === "json_object"
          ? { text: { format: { type: "json_object" } } }
          : {}),
      ...(config.temperature !== undefined
        ? { temperature: config.temperature }
        : {}),
      ...config.extraBody,
    };
  return {
    model: config.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: call.user },
    ],
    [config.maxTokensParam]: config.maxOutputTokens,
    ...(config.jsonMode === "json_schema"
      ? {
          response_format: {
            type: "json_schema",
            json_schema: {
              name: call.schemaName,
              strict: true,
              schema: call.schema,
            },
          },
        }
      : config.jsonMode === "json_object"
        ? { response_format: { type: "json_object" } }
        : {}),
    ...(config.temperature !== undefined
      ? { temperature: config.temperature }
      : {}),
    ...config.extraBody,
  };
}

function extractText(
  config: AiConfig,
  body: Record<string, unknown>,
): { text: string; model?: string } {
  const model = typeof body.model === "string" ? body.model : undefined;
  if (config.apiStyle === "responses") {
    if (body.status === "incomplete")
      throw new AiError(
        "truncated",
        "The model response was cut off; raise AI_MAX_OUTPUT_TOKENS.",
      );
    const output =
      (body.output as
        | {
            type?: string;
            content?: { type: string; text?: string; refusal?: string }[];
          }[]
        | undefined) ?? [];
    const parts = output.flatMap((o) => o.content ?? []);
    const refusal = parts.find((p) => p.type === "refusal");
    if (refusal)
      throw new AiError(
        "refused",
        `The model refused: ${refusal.refusal ?? ""}`.trim(),
      );
    const text = parts
      .filter((p) => p.type === "output_text")
      .map((p) => p.text ?? "")
      .join("");
    return { text, ...(model ? { model } : {}) };
  }
  const choice = (
    body.choices as
      | {
          finish_reason?: string;
          message?: { content?: unknown; refusal?: string | null };
        }[]
      | undefined
  )?.[0];
  if (!choice)
    throw new AiError("invalid_output", "The provider returned no choices.");
  if (choice.message?.refusal)
    throw new AiError(
      "refused",
      `The model refused: ${choice.message.refusal}`,
    );
  if (choice.finish_reason === "length")
    throw new AiError(
      "truncated",
      "The model response was cut off; raise AI_MAX_OUTPUT_TOKENS.",
    );
  const content = choice.message?.content;
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map((p: { text?: string }) => p.text ?? "").join("")
        : "";
  return { text, ...(model ? { model } : {}) };
}

function usageOf(body: Record<string, unknown>): ModelResult["usage"] {
  const u = body.usage as Record<string, unknown> | undefined;
  if (!u) return undefined;
  const pick = (...keys: string[]) => {
    for (const k of keys) if (typeof u[k] === "number") return u[k] as number;
    return undefined;
  };
  const inputTokens = pick("prompt_tokens", "input_tokens");
  const outputTokens = pick("completion_tokens", "output_tokens");
  return {
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
  };
}

/** Calls the configured model once per request (with bounded retries for transient errors). */
export async function callModel(
  config: AiConfig,
  call: ModelCall,
  fetchImpl: typeof fetch = fetch,
): Promise<ModelResult> {
  const body = JSON.stringify(requestBody(config, call));
  if (Buffer.byteLength(body) > config.maxInputBytes)
    throw new AiError(
      "input_too_large",
      "The request exceeds AI_MAX_INPUT_BYTES.",
    );
  const url = `${config.baseUrl}/${config.apiStyle === "responses" ? "responses" : "chat/completions"}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    ...config.headers,
  };
  const started = Date.now();
  let lastError: AiError | undefined;
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(config.timeoutMs),
        redirect: "error",
      });
    } catch (error) {
      const timeout =
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      const cause =
        error instanceof Error && error.cause instanceof Error
          ? `: ${error.cause.message}`
          : "";
      lastError = timeout
        ? new AiError(
            "timeout",
            `The provider did not answer within ${config.timeoutMs} ms (AI_TIMEOUT_MS).`,
          )
        : new AiError(
            "network",
            redact(
              `Could not reach ${new URL(url).host}${cause}`,
              config.apiKey,
            ),
          );
      if (attempt < config.maxAttempts) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
        continue;
      }
      throw lastError;
    }
    const text = await response.text();
    if (!response.ok) {
      let detail = text.slice(0, 500);
      try {
        const parsed = JSON.parse(text) as {
          error?: { message?: string } | string;
          message?: string;
        };
        detail =
          (typeof parsed.error === "string"
            ? parsed.error
            : parsed.error?.message) ??
          parsed.message ??
          detail;
      } catch {
        /* keep raw text */
      }
      lastError = new AiError(
        "http",
        redact(
          `${config.provider} returned HTTP ${response.status}: ${String(detail).slice(0, 300)}`,
          config.apiKey,
        ),
        response.status,
      );
      if (
        (response.status === 429 || response.status >= 500) &&
        attempt < config.maxAttempts
      ) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const wait =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter, 10) * 1000
            : 500 * attempt;
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw lastError;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new AiError(
        "invalid_output",
        "The provider returned a non-JSON response.",
      );
    }
    const { text: content, model } = extractText(config, parsed);
    if (!content.trim())
      throw new AiError(
        "invalid_output",
        "The model returned an empty answer.",
      );
    const usage = usageOf(parsed);
    return {
      data: parseModelJson(content),
      model: model ?? config.model,
      provider: config.provider,
      latencyMs: Date.now() - started,
      attempts: attempt,
      ...(usage ? { usage } : {}),
    };
  }
  throw lastError ?? new AiError("network", "The provider call failed.");
}
