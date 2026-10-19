import type { Provider } from "./types";
export type Preset = "openai" | "openrouter" | "ollama" | "custom";
export const PRESETS: {
  id: Preset;
  label: string;
  provider: string;
  baseUrl: string;
  allowHttp?: boolean;
  hint: string;
  /** Suggested request extras (prefilled into "Extra body" when it is empty). */
  extraBody?: Record<string, unknown>;
  /** Why the suggestion matters (shown under the presets). */
  note?: string;
}[] = [
  {
    id: "openai",
    label: "OpenAI",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    hint: "GPT models through the official API.",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    provider: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    hint: "Hundreds of models (Qwen, Llama, Claude…) with one key.",
    extraBody: { provider: { data_collection: "deny" } },
    note: "We prefilled Extra body with provider.data_collection = \"deny\": OpenRouter then only routes to upstream providers that don't store or train on your prompts (players' match data). Remove it only if you accept that.",
  },
  {
    id: "ollama",
    label: "Ollama",
    provider: "ollama",
    baseUrl: "http://127.0.0.1:11434/v1",
    allowHttp: true,
    hint: "Local models on your own machine, no key needed.",
  },
  {
    id: "custom",
    label: "Custom",
    provider: "",
    baseUrl: "",
    hint: "Any OpenAI-compatible endpoint.",
  },
];
export const presetOf = (p: Provider | null): Preset => {
  if (!p) return "openai";
  const hit = PRESETS.find(
    (x) => x.id !== "custom" && x.provider === p.provider,
  );
  return hit?.id ?? "custom";
};

export type Form = {
  name: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
  keyAction: "keep" | "replace" | "remove";
  apiStyle: "" | "chat" | "responses";
  jsonMode: "" | "json_schema" | "json_object" | "prompt";
  maxTokensParam: string;
  maxOutputTokens: string;
  timeoutMs: string;
  maxAttempts: string;
  temperature: string;
  allowHttp: boolean;
  headers: string;
  headersDirty: boolean;
  extraBody: string;
  extraBodyDirty: boolean;
};
const str = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? String(v) : "";
export function formFrom(p: Provider | null): Form {
  return {
    name: p?.name ?? "OpenAI",
    provider: p?.provider ?? "openai",
    baseUrl: p?.baseUrl ?? (p ? "" : "https://api.openai.com/v1"),
    apiKey: "",
    keyAction: p?.keyConfigured ? "keep" : "replace",
    apiStyle: p?.apiStyle ?? "",
    jsonMode: p?.jsonMode ?? "",
    maxTokensParam: p?.maxTokensParam ?? "",
    maxOutputTokens: str(p?.maxOutputTokens),
    timeoutMs: str(p?.timeoutMs),
    maxAttempts: str(p?.maxAttempts),
    temperature: str(p?.temperature),
    allowHttp: p?.allowHttp === true,
    headers: "",
    headersDirty: false,
    extraBody:
      p?.extraBody && Object.keys(p.extraBody).length
        ? JSON.stringify(p.extraBody, null, 2)
        : "",
    extraBodyDirty: false,
  };
}

/** Parses a JSON object textarea; empty means {}. */
export function parseObject(
  text: string,
  strings: boolean,
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  if (!text.trim()) return { ok: true, value: {} };
  try {
    const v = JSON.parse(text) as unknown;
    if (typeof v !== "object" || v === null || Array.isArray(v))
      return { ok: false, error: "Must be a JSON object." };
    if (strings) {
      for (const [k, val] of Object.entries(v)) {
        if (!/^[A-Za-z0-9-]{1,64}$/.test(k))
          return {
            ok: false,
            error: "Header names may use letters, digits and dashes only.",
          };
        if (typeof val !== "string")
          return { ok: false, error: "Header values must be strings." };
      }
      if (Object.keys(v).length > 20)
        return { ok: false, error: "At most 20 headers." };
    }
    return { ok: true, value: v as Record<string, unknown> };
  } catch {
    return { ok: false, error: "Invalid JSON." };
  }
}
export type ParsedObject = ReturnType<typeof parseObject>;
