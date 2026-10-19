import { describe, expect, it } from "vitest";
import { AiError, type AiConfig } from "@cs2/coaching";
import { RuntimeEnv } from "../../src/config/env.js";
import type { SecretCipher } from "../../src/infrastructure/secrets/aes-gcm-secret-cipher.js";
import { AiAccessService } from "../../src/modules/ai-config/ai-access.service.js";
import type { AssignmentMap } from "../../src/modules/ai-config/ai-config.dto.js";
import {
  AiConfigFactory,
  UNDECRYPTABLE,
} from "../../src/modules/ai-config/ai-config.factory.js";
import type {
  AiConfigRepository,
  AiProviderRecord,
} from "../../src/modules/ai-config/ai-config.repository.js";
import {
  aiRequestError,
  providerTestError,
} from "../../src/modules/ai-config/ai-errors.js";
import {
  AiSettingsService,
  AssignedProviderSource,
  EnvironmentSource,
} from "../../src/modules/ai-config/ai-settings.service.js";
import { silentLogger } from "../../src/shared/logging/logger.js";
import { appError } from "./fakes.js";

const cipher = (fail = false): SecretCipher => ({
  encrypt: (p) => `enc:${p}`,
  decrypt: (c) => {
    if (fail) throw new Error("bad tag");
    return c.replace(/^enc:/, "");
  },
});
const provider: AiProviderRecord = {
  id: "p1",
  name: "Main",
  provider: "custom",
  baseUrl: "https://llm.example/v1",
  apiKeyEnc: "enc:sk-db-key-123456",
  keyLast4: "3456",
  headersEnc: null,
  headerNames: [],
  options: {},
  createdAt: "",
  updatedAt: "",
};

class FakeAiRepo implements AiConfigRepository {
  loads = 0;
  providerRows: AiProviderRecord[] = [provider];
  assigned: AssignmentMap = {};
  settings: Record<string, unknown> = {};
  async providers() {
    this.loads++;
    return this.providerRows;
  }
  async saveProvider() {}
  async deleteProvider() {
    return "ok" as const;
  }
  async assignments() {
    return this.assigned;
  }
  async setAssignments() {}
  async appSettings() {
    return { settings: this.settings, updatedAt: null };
  }
  async saveAppSettings() {}
}

function setup(env: Record<string, string> = {}, failDecrypt = false) {
  const runtime = new RuntimeEnv(() => env);
  const factory = new AiConfigFactory(cipher(failDecrypt), runtime);
  const repo = new FakeAiRepo();
  let now = 0;
  const settings = new AiSettingsService(
    repo,
    [new AssignedProviderSource(factory), new EnvironmentSource(factory)],
    1000,
    () => now,
  );
  return { repo, settings, factory, tick: (ms: number) => (now += ms) };
}
const ENV = {
  AI_PROVIDER: "envp",
  AI_BASE_URL: "https://env.example/v1",
  AI_API_KEY: "k",
  AI_MODEL: "env-model",
};

describe("AI configuration resolution (Strategy chain + Factory)", () => {
  it("uses the assigned provider over the environment", async () => {
    const { repo, settings } = setup(ENV);
    repo.assigned = {
      review_quick: { providerId: "p1", model: "db-model", updatedAt: "" },
    };
    const review = await settings.resolve("review_quick");
    expect(review).toMatchObject({
      source: "database",
      providerId: "p1",
      providerName: "Main",
    });
    expect(review.result.ok && review.result.config.model).toBe("db-model");
    expect(review.result.ok && review.result.config.apiKey).toBe(
      "sk-db-key-123456",
    );
    const live = await settings.resolve("live");
    expect(live.source).toBe("env");
    expect(live.result.ok && live.result.config.model).toBe("env-model");
    // Deep reviews and reports fall back to the quick review assignment.
    const deep = await settings.resolve("review_deep");
    expect(deep.source).toBe("database");
    expect(deep.result.ok && deep.result.config.model).toBe("db-model");
    expect((await settings.resolve("report")).source).toBe("database");
  });
  it("a deep review assignment overrides the quick one", async () => {
    const { repo, settings } = setup(ENV);
    repo.assigned = {
      review_quick: { providerId: "p1", model: "small", updatedAt: "" },
      review_deep: { providerId: "p1", model: "large", updatedAt: "" },
    };
    const deep = await settings.resolve("review_deep");
    expect(deep.result.ok && deep.result.config.model).toBe("large");
    const quick = await settings.resolve("review_quick");
    expect(quick.result.ok && quick.result.config.model).toBe("small");
  });
  it("falls back to env when the assigned provider row is gone; reports missing env", async () => {
    const { repo, settings } = setup({});
    repo.assigned = {
      review_quick: { providerId: "missing", model: "m", updatedAt: "" },
    };
    const resolved = await settings.resolve("review_quick");
    expect(resolved.source).toBe("env");
    expect(resolved.result.ok).toBe(false);
  });
  it("reports undecryptable credentials instead of throwing", async () => {
    const { repo, settings } = setup(ENV, true);
    repo.assigned = {
      review_quick: { providerId: "p1", model: "m", updatedAt: "" },
    };
    expect((await settings.resolve("review_quick")).result).toEqual({
      ok: false,
      reason: UNDECRYPTABLE,
      missing: [],
    });
  });
  it("admin settings override env limits; the snapshot is cached until TTL or invalidate()", async () => {
    const { repo, settings, tick } = setup({ ...ENV, AI_DAILY_LIMIT: "5" });
    const limit = async () => {
      const r = await settings.resolve("review_quick");
      return r.result.ok ? r.result.config.dailyLimit : "x";
    };
    expect(await limit()).toBe(5);
    repo.settings = { dailyLimit: 2 };
    expect(await limit()).toBe(5);
    expect(repo.loads).toBe(1);
    settings.invalidate();
    expect(await limit()).toBe(2);
    tick(1001);
    repo.settings = {};
    expect(await limit()).toBe(5);
    expect(repo.loads).toBe(3);
    expect(await settings.sampleDemoEnabled()).toBe(true);
  });
});

describe("AiAccessService", () => {
  const gateway = {
    review: () => Promise.reject(new Error("unused")),
    liveCall: () => Promise.reject(new Error("unused")),
    monthlyReport: () => Promise.reject(new Error("unused")),
    personalCoach: () => Promise.reject(new Error("unused")),
    connectivityCheck: async (c: AiConfig) => ({
      ok: true as const,
      provider: c.provider,
      model: c.model,
      latencyMs: 1,
      reply: "hi",
    }),
  };
  it("503 ai_not_configured with missing/purpose/source details", async () => {
    const { settings } = setup({});
    const access = new AiAccessService(
      settings,
      { reserveDailyRequest: async () => true },
      gateway,
      silentLogger,
    );
    const err = await appError(access.acquire("o", "live"));
    expect(err.status).toBe(503);
    expect(err.body).toMatchObject({
      code: "ai_not_configured",
      purpose: "live",
      source: "env",
    });
    expect(Array.isArray(err.body.missing)).toBe(true);
  });
  it("429 ai_limit when the daily reservation fails; unlimited skips it", async () => {
    let calls = 0;
    const usage = { reserveDailyRequest: async () => (calls++, false) };
    const limited = new AiAccessService(
      setup({ ...ENV, AI_DAILY_LIMIT: "3" }).settings,
      usage,
      gateway,
      silentLogger,
    );
    expect(await appError(limited.acquire("o", "review_quick"))).toMatchObject({
      status: 429,
      body: {
        error: "Daily AI limit of 3 requests reached.",
        code: "ai_limit",
      },
    });
    const unlimited = new AiAccessService(
      setup({ ...ENV, AI_DAILY_LIMIT: "0" }).settings,
      usage,
      gateway,
      silentLogger,
    );
    expect((await unlimited.acquire("o", "review_quick")).model).toBe(
      "env-model",
    );
    expect(calls).toBe(1);
  });
  it("hides provider details from non-admins in status and runs the admin test", async () => {
    const access = new AiAccessService(
      setup(ENV).settings,
      { reserveDailyRequest: async () => true },
      gateway,
      silentLogger,
    );
    expect(await access.status(false)).toEqual({
      configured: true,
      purposes: {
        review: { configured: true },
        review_quick: { configured: true },
        review_deep: { configured: true },
        live: { configured: true },
        report: { configured: true },
        personal_coach: { configured: true },
      },
    });
    expect(await access.status(true)).toMatchObject({
      model: "env-model",
      endpoint: "env.example",
    });
    expect(await access.test("a", "live")).toMatchObject({
      purpose: "live",
      reply: "hi",
    });
  });
});

describe("AI error mapping", () => {
  it("maps model failures to statuses with generic texts for non-admins", () => {
    const cases: Array<[AiError, number]> = [
      [new AiError("timeout", "model x timed out"), 504],
      [new AiError("between_rounds_only", "live"), 409],
      [new AiError("http", "vendor said no", 401), 502],
    ];
    for (const [error, status] of cases) {
      const pub = aiRequestError(error, false);
      expect(pub.statusCode).toBe(status);
      expect(pub.body().error).not.toContain("model x");
      expect(pub.body().code).toBe(`ai_${error.code}`);
      expect(pub.body().providerStatus).toBeUndefined();
    }
    expect(
      aiRequestError(new AiError("http", "vendor said no", 401), true).body(),
    ).toEqual({
      error: "vendor said no",
      code: "ai_http",
      providerStatus: 401,
    });
    expect(aiRequestError(new Error("boom"), true).body()).toEqual({
      error: "The AI request failed.",
      code: "ai_failed",
    });
  });
  it("maps provider tests to {ok:false} bodies", () => {
    const timeout = providerTestError(new AiError("timeout", "slow"));
    expect([timeout.statusCode, timeout.body()]).toEqual([
      504,
      { error: "slow", ok: false, code: "ai_timeout" },
    ]);
    expect(providerTestError(new Error("x")).body()).toEqual({
      error: "The AI request failed.",
      ok: false,
      code: "ai_failed",
    });
  });
});

describe("per-purpose output budgets and assignment options", () => {
  it("defaults the output budget per purpose and lets the assignment override it", async () => {
    const { repo, settings } = setup(ENV);
    repo.assigned = {
      review_quick: { providerId: "p1", model: "small", updatedAt: "" },
      review_deep: {
        providerId: "p1",
        model: "reasoner",
        updatedAt: "",
        maxOutputTokens: 20_000,
        reasoningEffort: "low",
      },
    };
    const quick = await settings.resolve("review_quick");
    expect(quick.result.ok && quick.result.config.maxOutputTokens).toBe(16_000);
    const deep = await settings.resolve("review_deep");
    expect(deep.result.ok && deep.result.config.maxOutputTokens).toBe(20_000);
    expect(deep.result.ok && deep.result.config.extraBody).toEqual({
      reasoning: { effort: "low" },
    });
    // personal_coach falls back to the deep assignment (its options included).
    const personal = await settings.resolve("personal_coach");
    expect(personal.result.ok && personal.result.config.model).toBe("reasoner");
    // Unassigned purposes use the environment with the purpose's budget.
    const live = await settings.resolve("live");
    expect(live.result.ok && live.result.config.maxOutputTokens).toBe(8_000);
  });
  it("a provider profile budget beats the purpose default; env AI_MAX_OUTPUT_TOKENS too", async () => {
    const { repo, settings } = setup({ ...ENV, AI_MAX_OUTPUT_TOKENS: "3000" });
    repo.providerRows = [
      {
        ...provider,
        options: {
          maxOutputTokens: 5000,
          extraBody: { reasoning: { exclude: true } },
        },
      },
    ];
    repo.assigned = {
      review_quick: {
        providerId: "p1",
        model: "m",
        updatedAt: "",
        reasoningEffort: "high",
      },
    };
    const quick = await settings.resolve("review_quick");
    expect(quick.result.ok && quick.result.config.maxOutputTokens).toBe(5000);
    expect(quick.result.ok && quick.result.config.extraBody).toEqual({
      reasoning: { exclude: true, effort: "high" },
    });
    const live = await settings.resolve("live");
    expect(live.result.ok && live.result.config.maxOutputTokens).toBe(3000);
  });
  it("uses OpenAI's reasoning_effort dialect for OpenAI chat profiles", async () => {
    const { withReasoning } =
      await import("../../src/modules/ai-config/ai-config.factory.js");
    expect(withReasoning({}, "low", "openai", "chat")).toEqual({
      reasoning_effort: "low",
    });
    expect(withReasoning({}, "low", "openai", "responses")).toEqual({
      reasoning: { effort: "low" },
    });
    expect(withReasoning({ a: 1 }, undefined, "openrouter", "chat")).toEqual({
      a: 1,
    });
  });
  it("validates assignment options", async () => {
    const { assignmentsSchema } =
      await import("../../src/modules/ai-config/ai-config.dto.js");
    const id = "3f2b6c1e-9a4d-4c8e-b1f2-7d6e5a4b3c2d";
    expect(
      assignmentsSchema.parse({
        live: {
          providerId: id,
          model: "m",
          maxOutputTokens: 6000,
          reasoningEffort: null,
        },
      }),
    ).toEqual({ live: { providerId: id, model: "m", maxOutputTokens: 6000 } });
    for (const bad of [
      { providerId: id, model: "m", maxOutputTokens: 10 },
      { providerId: id, model: "m", reasoningEffort: "max" },
      { providerId: id, model: "m", tools: [] },
    ])
      expect(assignmentsSchema.safeParse({ live: bad }).success).toBe(false);
  });
});
