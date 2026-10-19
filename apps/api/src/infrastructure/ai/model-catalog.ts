import type { AiConfig } from "@cs2/coaching";

export type ModelListing =
  | { supported: true; models: string[] }
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
      return { supported: true, models: modelIds(list) };
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
