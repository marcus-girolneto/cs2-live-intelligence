import type { AiConfig } from "@cs2/coaching";

/** Extra model facts when the provider exposes them (OpenRouter-style /models). */
export type ModelDetail = {
  id: string;
  name?: string;
  contextLength?: number;
  /** USD per million input/output tokens. */
  pricePerMTokIn?: number;
  pricePerMTokOut?: number;
  structuredOutputs?: boolean;
};
export type ModelListing =
  | { supported: true; models: string[]; details?: ModelDetail[] }
  | { supported: false; models: []; error: string };

/** Port: the model ids an OpenAI-compatible provider offers (GET {baseUrl}/models). */
export interface ModelCatalog {
  list(config: AiConfig): Promise<ModelListing>;
}

const unsupported = (error: string): ModelListing => ({
  supported: false,
  models: [],
  error,
});

/** Model ids from `data[]` or `models[]` entries (strings or {id|name}), unique and sorted. */
export function modelIds(list: unknown[]): string[] {
  return [
    ...new Set(
      list
        .map((m) =>
          typeof m === "string"
            ? m
            : typeof m === "object" && m !== null
              ? ((m as { id?: unknown; name?: unknown }).id ??
                (m as { name?: unknown }).name)
              : undefined,
        )
        .filter(
          (m): m is string =>
            typeof m === "string" && m.length > 0 && m.length <= 200,
        ),
    ),
  ]
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 2000);
}

const perMillion = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n >= 0
    ? Math.round(n * 1_000_000 * 10_000) / 10_000
    : undefined;
};
const short = (v: unknown, max: number): string | undefined =>
  typeof v === "string" && v.length > 0 && v.length <= max ? v : undefined;

/**
 * Pricing, context length and structured-output support when entries carry them (OpenRouter:
 * pricing.prompt/completion in USD per token, context_length, supported_parameters). Undefined
 * when no entry has any of them (plain OpenAI-compatible lists).
 */
export function modelDetails(list: unknown[]): ModelDetail[] | undefined {
  const details = new Map<string, ModelDetail>();
  let rich = false;
  for (const m of list) {
    if (typeof m !== "object" || m === null) continue;
    const e = m as Record<string, unknown>;
    const id = short(e.id, 200);
    if (!id || details.has(id)) continue;
    const pricing = (e.pricing ?? {}) as Record<string, unknown>;
    const params = Array.isArray(e.supported_parameters)
      ? e.supported_parameters
      : undefined;
    const ctx = Number(e.context_length);
    const d: ModelDetail = {
      id,
      ...(short(e.name, 200) && e.name !== id
        ? { name: e.name as string }
        : {}),
      ...(Number.isInteger(ctx) && ctx > 0 ? { contextLength: ctx } : {}),
      ...(perMillion(pricing.prompt) !== undefined
        ? { pricePerMTokIn: perMillion(pricing.prompt) }
        : {}),
      ...(perMillion(pricing.completion) !== undefined
        ? { pricePerMTokOut: perMillion(pricing.completion) }
        : {}),
      ...(params
        ? {
            structuredOutputs:
              params.includes("structured_outputs") ||
              params.includes("response_format"),
          }
        : {}),
    };
    if (Object.keys(d).length > 1) rich = true;
    details.set(id, d);
  }
  return rich
    ? [...details.values()]
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, 2000)
    : undefined;
}

/** HTTP adapter; never throws (failures become `supported: false` with a safe message). */
export class HttpModelCatalog implements ModelCatalog {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}
  async list(c: AiConfig): Promise<ModelListing> {
    try {
      const response = await this.fetchImpl(`${c.baseUrl}/models`, {
        headers: {
          accept: "application/json",
          ...(c.apiKey ? { authorization: `Bearer ${c.apiKey}` } : {}),
          ...c.headers,
        },
        redirect: "error",
        signal: AbortSignal.timeout(Math.min(c.timeoutMs, 15_000)),
      });
      if (!response.ok)
        return unsupported(
          `The provider answered HTTP ${response.status} for /models.`,
        );
      const text = await response.text();
      if (text.length > 4 * 1024 * 1024)
        return unsupported("Model list too large.");
      const body = JSON.parse(text) as { data?: unknown; models?: unknown };
      const list = Array.isArray(body.data)
        ? body.data
        : Array.isArray(body.models)
          ? body.models
          : null;
      if (!list)
        return unsupported("The provider did not return a model list.");
      const details = modelDetails(list);
      return {
        supported: true,
        models: modelIds(list),
        ...(details ? { details } : {}),
      };
    } catch (error) {
      const timeout =
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      return unsupported(
        timeout
          ? "The provider did not answer in time."
          : "The provider model list is unavailable.",
      );
    }
  }
}
