import { describe, expect, it } from "vitest";
import {
  AiError,
  callModel,
  loadAiConfig,
  parseModelJson,
  type AiConfig,
} from "./provider.js";

const ok = (env: Record<string, string>): AiConfig => {
  const r = loadAiConfig(env);
  if (!r.ok) throw new Error(r.reason);
  return r.config;
};
const call = {
  system: "sys",
  user: "{}",
  schemaName: "x",
  schema: { type: "object" },
};
const reply = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers,
  });
const chat = (content: unknown, extra: Record<string, unknown> = {}) =>
  reply({
    model: "served-model",
    choices: [{ finish_reason: "stop", message: { content } }],
    ...extra,
  });

describe("AI configuration", () => {
  it("is not configured without provider/base URL and model", () => {
    const r = loadAiConfig({});
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.missing).toEqual(["AI_PROVIDER or AI_BASE_URL", "AI_MODEL"]);
  });
  it("never invents a model", () => {
    const r = loadAiConfig({ AI_PROVIDER: "openai", AI_API_KEY: "k" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toContain("AI_MODEL");
  });
  it("resolves provider presets", () => {
    expect(
      ok({ AI_PROVIDER: "openai", AI_API_KEY: "k", AI_MODEL: "m" }),
    ).toMatchObject({
      baseUrl: "https://api.openai.com/v1",
      maxTokensParam: "max_completion_tokens",
      apiStyle: "chat",
    });
    expect(
      ok({
        AI_PROVIDER: "openrouter",
        AI_API_KEY: "k",
        AI_MODEL: "qwen/qwen3",
      }),
    ).toMatchObject({
      baseUrl: "https://openrouter.ai/api/v1",
      maxTokensParam: "max_tokens",
    });
    expect(ok({ AI_PROVIDER: "ollama", AI_MODEL: "qwen3" }).apiKey).toBe("");
  });
  it("accepts any OpenAI-compatible endpoint and custom options", () => {
    const c = ok({
      AI_PROVIDER: "together",
      AI_BASE_URL: "https://api.example.com/v1/",
      AI_API_KEY: "k",
      AI_MODEL: "custom/model",
      AI_API_STYLE: "chat",
      AI_JSON_MODE: "json_object",
      AI_MAX_OUTPUT_TOKENS: "8000",
      AI_TIMEOUT_MS: "30000",
      AI_MAX_ATTEMPTS: "3",
      AI_TEMPERATURE: "0.2",
      AI_HEADERS: '{"X-Title":"CS2"}',
      AI_EXTRA_BODY: '{"provider":{"require_parameters":true}}',
      AI_DAILY_LIMIT: "20",
    });
    expect(c).toMatchObject({
      provider: "together",
      baseUrl: "https://api.example.com/v1",
      jsonMode: "json_object",
      maxOutputTokens: 8000,
      maxAttempts: 3,
      temperature: 0.2,
      headers: { "X-Title": "CS2" },
      extraBody: { provider: { require_parameters: true } },
      dailyLimit: 20,
    });
    expect(
      ok({ AI_BASE_URL: "https://x.test/v1", AI_API_KEY: "k", AI_MODEL: "m" })
        .dailyLimit,
    ).toBeNull();
  });
  it("treats empty variables (as passed by Compose) as unset", () => {
    expect(
      ok({
        AI_PROVIDER: "openrouter",
        AI_BASE_URL: "",
        AI_API_KEY: "k",
        AI_MODEL: "m",
        AI_API_STYLE: "",
        AI_JSON_MODE: " ",
        AI_HEADERS: "",
        AI_DAILY_LIMIT: "",
        OPENAI_API_KEY: "",
      }),
    ).toMatchObject({
      baseUrl: "https://openrouter.ai/api/v1",
      apiStyle: "chat",
      jsonMode: "json_schema",
      dailyLimit: null,
    });
    expect(
      loadAiConfig({ AI_PROVIDER: "", AI_MODEL: "", OPENAI_API_KEY: "" }).ok,
    ).toBe(false);
  });
  it("keeps legacy OPENAI_* variables working", () => {
    expect(ok({ OPENAI_API_KEY: "k", OPENAI_MODEL: "gpt" })).toMatchObject({
      provider: "openai",
      model: "gpt",
      apiStyle: "responses",
    });
  });
  it("rejects insecure or malformed settings", () => {
    for (const env of [
      {
        AI_BASE_URL: "http://remote.example/v1",
        AI_API_KEY: "k",
        AI_MODEL: "m",
      },
      { AI_BASE_URL: "https://u:p@x.test/v1", AI_API_KEY: "k", AI_MODEL: "m" },
      {
        AI_PROVIDER: "openai",
        AI_API_KEY: "k",
        AI_MODEL: "m",
        AI_HEADERS: "[1]",
      },
      {
        AI_PROVIDER: "openai",
        AI_API_KEY: "k",
        AI_MODEL: "m",
        AI_HEADERS: '{"a":"b\\nc"}',
      },
      {
        AI_PROVIDER: "openai",
        AI_API_KEY: "k",
        AI_MODEL: "m",
        AI_JSON_MODE: "xml",
      },
      {
        AI_PROVIDER: "openai",
        AI_API_KEY: "k",
        AI_MODEL: "m",
        AI_TEMPERATURE: "9",
      },
      {
        AI_PROVIDER: "openai",
        AI_API_KEY: "k",
        AI_MODEL: "m",
        AI_MAX_ATTEMPTS: "0",
      },
    ])
      expect(loadAiConfig(env).ok, JSON.stringify(env)).toBe(false);
    expect(
      loadAiConfig({ AI_BASE_URL: "https://x.test/v1", AI_MODEL: "m" }),
    ).toMatchObject({
      ok: false,
      missing: ["AI_API_KEY"],
    });
    expect(
      loadAiConfig({
        AI_BASE_URL: "http://gpu.lan/v1",
        AI_ALLOW_HTTP: "true",
        AI_MODEL: "m",
        AI_HEADERS: '{"api-key":"k"}',
      }).ok,
    ).toBe(true);
  });
});

describe("model call", () => {
  it("sends a structured chat request with configured params", async () => {
    let url = "";
    let body: Record<string, unknown> = {};
    let headers: Record<string, string> = {};
    const c = ok({
      AI_PROVIDER: "openrouter",
      AI_API_KEY: "secret",
      AI_MODEL: "qwen/qwen3",
      AI_TEMPERATURE: "0.3",
      AI_HEADERS: '{"HTTP-Referer":"http://127.0.0.1:3000"}',
      AI_EXTRA_BODY: '{"provider":{"require_parameters":true}}',
    });
    const r = await callModel(c, call, (async (
      u: string,
      init: RequestInit,
    ) => {
      url = u;
      body = JSON.parse(String(init.body));
      headers = init.headers as Record<string, string>;
      return chat('{"ok":true}', {
        usage: { prompt_tokens: 3, completion_tokens: 4 },
      });
    }) as unknown as typeof fetch);
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(headers).toMatchObject({
      Authorization: "Bearer secret",
      "HTTP-Referer": "http://127.0.0.1:3000",
    });
    expect(body).toMatchObject({
      model: "qwen/qwen3",
      max_tokens: 4096,
      temperature: 0.3,
      provider: { require_parameters: true },
      response_format: {
        type: "json_schema",
        json_schema: { name: "x", strict: true },
      },
    });
    expect(r).toMatchObject({
      data: { ok: true },
      model: "served-model",
      usage: { inputTokens: 3, outputTokens: 4 },
    });
  });
  it("puts the schema in the prompt for json_object and prompt modes", async () => {
    for (const mode of ["json_object", "prompt"]) {
      let body: { messages: { content: string }[]; response_format?: unknown } =
        { messages: [] };
      await callModel(
        ok({
          AI_PROVIDER: "openrouter",
          AI_API_KEY: "k",
          AI_MODEL: "m",
          AI_JSON_MODE: mode,
        }),
        call,
        (async (_u: string, init: RequestInit) => {
          body = JSON.parse(String(init.body));
          return chat('```json\n{"ok":1}\n```');
        }) as unknown as typeof fetch,
      );
      expect(body.messages[0]!.content).toContain("JSON Schema");
      expect(body.response_format === undefined).toBe(mode === "prompt");
    }
  });
  it("supports the Responses API style", async () => {
    let url = "";
    const r = await callModel(
      ok({
        AI_PROVIDER: "openai",
        AI_API_KEY: "k",
        AI_MODEL: "gpt-x",
        AI_API_STYLE: "responses",
      }),
      call,
      (async (u: string) => {
        url = u;
        return reply({
          status: "completed",
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: '{"a":2}' }],
            },
          ],
        });
      }) as unknown as typeof fetch,
    );
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(r.data).toEqual({ a: 2 });
  });
  it("reports provider errors with their message and never leaks the key", async () => {
    const c = ok({
      AI_PROVIDER: "openrouter",
      AI_API_KEY: "sk-leak",
      AI_MODEL: "m",
      AI_MAX_ATTEMPTS: "1",
    });
    const err = await callModel(c, call, (async () =>
      reply(
        { error: { message: "No endpoints found for model m (key sk-leak)" } },
        404,
      )) as unknown as typeof fetch).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.message).toContain("HTTP 404");
    expect(err.message).toContain("No endpoints found");
    expect(err.message).not.toContain("sk-leak");
  });
  it("retries transient failures but not client errors", async () => {
    let n = 0;
    const c = ok({
      AI_PROVIDER: "openrouter",
      AI_API_KEY: "k",
      AI_MODEL: "m",
      AI_MAX_ATTEMPTS: "2",
    });
    const r = await callModel(c, call, (async () =>
      ++n === 1
        ? reply("busy", 503)
        : chat('{"x":1}')) as unknown as typeof fetch);
    expect(r.attempts).toBe(2);
    n = 0;
    await expect(
      callModel(
        c,
        call,
        (async () => (n++, reply("bad", 400))) as unknown as typeof fetch,
      ),
    ).rejects.toThrow("HTTP 400");
    expect(n).toBe(1);
  });
  it("detects truncation, refusals, empty and invalid output", async () => {
    const c = ok({ AI_PROVIDER: "openrouter", AI_API_KEY: "k", AI_MODEL: "m" });
    const run = (res: Response) =>
      callModel(c, call, (async () => res) as unknown as typeof fetch).catch(
        (e: AiError) => e.code,
      );
    expect(
      await run(
        reply({
          choices: [{ finish_reason: "length", message: { content: "{" } }],
        }),
      ),
    ).toBe("truncated");
    expect(
      await run(
        reply({ choices: [{ message: { content: null, refusal: "no" } }] }),
      ),
    ).toBe("refused");
    expect(await run(chat(""))).toBe("invalid_output");
    expect(await run(chat("not json at all"))).toBe("invalid_output");
    expect(await run(reply({ choices: [] }))).toBe("invalid_output");
    const parts = await callModel(c, call, (async () =>
      chat([{ type: "text", text: '{"y":1}' }])) as unknown as typeof fetch);
    expect(parts.data).toEqual({ y: 1 });
  });
  it("reports timeouts and network failures", async () => {
    const c = ok({
      AI_PROVIDER: "openrouter",
      AI_API_KEY: "k",
      AI_MODEL: "m",
      AI_MAX_ATTEMPTS: "1",
      AI_TIMEOUT_MS: "1000",
    });
    const timeout = Object.assign(new Error("t"), { name: "TimeoutError" });
    expect(
      await callModel(c, call, (async () => {
        throw timeout;
      }) as unknown as typeof fetch).catch((e) => e.code),
    ).toBe("timeout");
    expect(
      await callModel(c, call, (async () => {
        throw new TypeError("fetch failed", {
          cause: new Error("certificate"),
        });
      }) as unknown as typeof fetch).catch((e) => e.message),
    ).toContain("certificate");
  });
  it("enforces the input budget", async () => {
    const c = ok({
      AI_PROVIDER: "openrouter",
      AI_API_KEY: "k",
      AI_MODEL: "m",
      AI_MAX_INPUT_BYTES: "1000",
    });
    await expect(
      callModel(c, { ...call, user: "x".repeat(2000) }),
    ).rejects.toMatchObject({ code: "input_too_large" });
  });
  it("parses JSON wrapped in prose", () => {
    expect(parseModelJson('Here you go: {"a":1} thanks')).toEqual({ a: 1 });
  });
});
