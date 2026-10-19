import { describe, expect, it } from "vitest";
import { NullPaymentGateway } from "../../src/infrastructure/billing/null-payment-gateway.js";
import { ConfiguredPaymentGatewaySource } from "../../src/infrastructure/billing/payment-gateway-factory.js";
import { StripePaymentGateway } from "../../src/infrastructure/billing/stripe-payment-gateway.js";
import type {
  IntegrationProbes,
  ProbeResult,
} from "../../src/infrastructure/integrations/http-integration-probes.js";
import { AesGcmSecretCipher } from "../../src/infrastructure/secrets/aes-gcm-secret-cipher.js";
import { HttpSteamClient } from "../../src/infrastructure/steam/http-steam-client.js";
import { CachedIntegrationConfig } from "../../src/modules/integrations/integration-config.provider.js";
import type {
  IntegrationsRepository,
  StoredIntegrationSettings,
  StoredSecret,
} from "../../src/modules/integrations/integrations.repository.js";
import { IntegrationsService } from "../../src/modules/integrations/integrations.service.js";
import { RefreshingSetting, ZonedClock } from "../../src/shared/clock/clock.js";
import { appError } from "./fakes.js";

const STEAM_KEY = "ABCDEF0123456789ABCDEF0123456789";
const STRIPE_KEY = "sk_test_unitSecretKey9876"; // gitleaks:allow (fake test value)
const WEBHOOK = "whsec_unitWebhookSecret5555"; // gitleaks:allow (fake test value)

class MemoryIntegrations implements IntegrationsRepository {
  rows = new Map<string, StoredSecret>();
  config = new Map<string, StoredIntegrationSettings>();
  reads = 0;
  async secrets() {
    this.reads++;
    return [...this.rows.values()];
  }
  async saveSecret(
    name: string,
    ciphertext: string,
    last4: string | null,
    by: string,
  ) {
    this.rows.set(name, {
      name,
      ciphertext,
      last4,
      updatedAt: new Date().toISOString(),
      updatedBy: by,
    });
  }
  async deleteSecret(name: string) {
    this.rows.delete(name);
  }
  async settings() {
    return [...this.config.values()];
  }
  async saveSettings(
    name: string,
    settings: Record<string, unknown>,
    by: string,
  ) {
    this.config.set(name, {
      name,
      settings,
      updatedAt: new Date().toISOString(),
      updatedBy: by,
    });
  }
}
class RecordingAudit {
  entries: { adminId: string; action: string; details: unknown }[] = [];
  async record(adminId: string, action: string, details: unknown) {
    this.entries.push({ adminId, action, details });
  }
}
class FakeProbes implements IntegrationProbes {
  calls: { name: string; key: string; steamId?: string }[] = [];
  async steam(key: string, steamId: string): Promise<ProbeResult> {
    this.calls.push({ name: "steam", key, steamId });
    return { ok: true, latencyMs: 5, detail: "ok" };
  }
  async stripe(key: string): Promise<ProbeResult> {
    this.calls.push({ name: "stripe", key });
    return { ok: true, latencyMs: 7, detail: "ok", livemode: false };
  }
}

function setup(env: Record<string, string | undefined> = {}) {
  const repo = new MemoryIntegrations();
  const cipher = new AesGcmSecretCipher(() => ({
    APP_ENCRYPTION_KEY: "unit-integrations-key",
  }));
  let now = 1_000;
  const config = new CachedIntegrationConfig(
    repo,
    cipher,
    () => env,
    30_000,
    () => now,
  );
  const audit = new RecordingAudit();
  const probes = new FakeProbes();
  const service = new IntegrationsService(
    repo,
    cipher,
    config,
    audit,
    probes,
    {
      steamId: async (id) => (id === "boss" ? "76561197960287930" : undefined),
    },
    "https://api.example",
  );
  return {
    repo,
    config,
    audit,
    probes,
    service,
    env,
    advance: (ms: number) => (now += ms),
  };
}

describe("IntegrationsService and the cached config provider", () => {
  it("prefers the database over the env bootstrap and reports the source", async () => {
    const { service, env } = setup({
      STEAM_WEB_API_KEY: "envkey0000000000wxyz",
    });
    let view = await service.view();
    expect(view.steam).toMatchObject({
      configured: true,
      source: "env",
      last4: "wxyz",
      updatedAt: null,
    });
    view = await service.updateSteam("boss", { webApiKey: STEAM_KEY });
    expect(view.steam).toMatchObject({
      configured: true,
      source: "database",
      last4: "6789",
    });
    expect(view.steam.updatedAt).toEqual(expect.any(String));
    // Clearing the stored key falls back to the env again; without env: none.
    view = await service.updateSteam("boss", { webApiKey: null });
    expect(view.steam.source).toBe("env");
    delete env.STEAM_WEB_API_KEY;
    view = await service.view();
    expect(view.steam).toMatchObject({
      configured: false,
      source: "none",
      last4: null,
    });
  });

  it("caches decrypted rows, re-reads after an admin change or the TTL", async () => {
    const { service, config, repo, advance } = setup();
    expect(await config.steamWebApiKey()).toBeUndefined();
    const reads = repo.reads;
    await config.steamWebApiKey();
    expect(repo.reads).toBe(reads); // cached
    await service.updateSteam("boss", { webApiKey: STEAM_KEY });
    expect(await config.steamWebApiKey()).toBe(STEAM_KEY); // invalidated
    // A change written by another instance shows up after the TTL.
    await repo.deleteSecret("steam.webApiKey");
    expect(await config.steamWebApiKey()).toBe(STEAM_KEY);
    advance(30_001);
    expect(await config.steamWebApiKey()).toBeUndefined();
  });

  it("stores ciphertext bound to the secret name and never returns or audits values", async () => {
    const { service, repo, audit } = setup();
    const view = await service.updateStripe("boss", {
      secretKey: STRIPE_KEY,
      webhookSecret: WEBHOOK,
      publishableKey: "pk_test_publishable123",
    });
    const stored = repo.rows.get("stripe.secretKey")!;
    expect(stored.ciphertext.startsWith("v1:")).toBe(true);
    expect(stored.ciphertext).not.toContain(STRIPE_KEY);
    const text = JSON.stringify(view) + JSON.stringify(audit.entries);
    expect(text).not.toContain(STRIPE_KEY);
    expect(text).not.toContain(WEBHOOK);
    expect(view.stripe).toMatchObject({
      configured: true,
      source: "database",
      secretKeyLast4: "9876",
      webhookConfigured: true,
      publishableKey: "pk_test_publishable123",
      enabled: true,
      active: true,
      webhookUrl: "https://api.example/v1/billing/webhook",
    });
    expect(audit.entries.at(-1)).toMatchObject({
      action: "integrations.stripe.update",
      details: {
        secretKey: "set",
        webhookSecret: "set",
        publishableKey: "set",
      },
    });
    // A ciphertext moved to another name does not decrypt (AAD binding).
    repo.rows.set("steam.webApiKey", { ...stored, name: "steam.webApiKey" });
    const moved = await service.view();
    expect(moved.steam).toMatchObject({
      configured: false,
      source: "database",
      undecryptable: true,
    });
  });

  it("switches Stripe on and off at runtime and keeps omitted fields", async () => {
    const { service, config } = setup();
    await service.updateStripe("boss", { secretKey: STRIPE_KEY });
    expect((await config.stripe()).active).toBe(false); // webhook secret missing
    await service.updateStripe("boss", { webhookSecret: WEBHOOK });
    expect((await config.stripe()).active).toBe(true);
    await service.updateStripe("boss", { enabled: false });
    const off = await config.stripe();
    expect(off).toMatchObject({ enabled: false, active: false });
    expect(off.secretKey).toBe(STRIPE_KEY); // kept
    await service.updateStripe("boss", {
      enabled: true,
      paymentMethods: { BRL: ["card", "pix"] },
    });
    expect(await config.stripe()).toMatchObject({
      active: true,
      paymentMethods: { BRL: ["card", "pix"], USD: ["card"] },
    });
    await service.updateStripe("boss", { paymentMethods: null });
    expect((await config.stripe()).paymentMethods.BRL).toEqual(["card"]);
  });

  it("tests the credential in effect with the admin's SteamID", async () => {
    const { service, probes, audit } = setup();
    expect(await service.test("boss", "steam")).toMatchObject({
      ok: false,
      detail: "No Steam Web API key.",
    });
    await service.updateSteam("boss", { webApiKey: STEAM_KEY });
    expect(await service.test("other", "steam")).toMatchObject({ ok: false });
    expect(await service.test("boss", "steam")).toMatchObject({ ok: true });
    await service.updateStripe("boss", { secretKey: STRIPE_KEY });
    expect(await service.test("boss", "stripe")).toMatchObject({
      ok: true,
      livemode: false,
    });
    expect(probes.calls).toEqual([
      { name: "steam", key: STEAM_KEY, steamId: "76561197960287930" },
      { name: "stripe", key: STRIPE_KEY },
    ]);
    expect(JSON.stringify(audit.entries)).not.toContain(STEAM_KEY);
  });

  it("answers 500 (not a crash) when no encryption key is configured", async () => {
    const repo = new MemoryIntegrations();
    const cipher = new AesGcmSecretCipher(() => ({}));
    const config = new CachedIntegrationConfig(repo, cipher, () => ({}));
    const service = new IntegrationsService(
      repo,
      cipher,
      config,
      new RecordingAudit(),
      new FakeProbes(),
      { steamId: async () => undefined },
      "https://api.example",
    );
    const failure = await appError(
      service.updateSteam("boss", { webApiKey: STEAM_KEY }),
    );
    expect(failure.status).toBe(500);
    expect(repo.rows.size).toBe(0);
  });
});

describe("runtime adapters", () => {
  it("the Steam client uses a newly saved key on the next call", async () => {
    const { service, config } = setup();
    const keys: (string | null)[] = [];
    const steamFetch = (async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.hostname === "api.steampowered.com")
        keys.push(url.searchParams.get("key"));
      return new Response("", { status: 503 });
    }) as typeof fetch;
    const client = new HttpSteamClient(steamFetch, () =>
      config.steamWebApiKey(),
    );
    await client.profile("76561197960287930");
    expect(keys).toEqual([]); // no key: public profile only
    await service.updateSteam("boss", { webApiKey: STEAM_KEY });
    await client.profile("76561197960287930");
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys)).toEqual(new Set([STEAM_KEY]));
  });

  it("the gateway source swaps Stripe and the Null Object per call", async () => {
    let creds = {
      secretKey: undefined as string | undefined,
      webhookSecret: undefined as string | undefined,
      active: false,
    };
    const source = new ConfiguredPaymentGatewaySource(async () => creds);
    expect(await source.current()).toBeInstanceOf(NullPaymentGateway);
    creds = { secretKey: STRIPE_KEY, webhookSecret: WEBHOOK, active: true };
    const first = await source.current();
    expect(first).toBeInstanceOf(StripePaymentGateway);
    expect(await source.current()).toBe(first); // reused while keys are unchanged
    creds = { ...creds, secretKey: STRIPE_KEY + "x" };
    expect(await source.current()).not.toBe(first);
    creds = { ...creds, active: false };
    expect((await source.current()).enabled).toBe(false);
  });

  it("the clock follows a refreshed time-zone setting", async () => {
    let stored: string = "America/Sao_Paulo";
    let now = 0;
    const zone = new RefreshingSetting(
      async () => stored,
      "UTC",
      1000,
      () => now,
    );
    await zone.refresh();
    const clock = new ZonedClock(
      () => zone.current(),
      () => Date.parse("2026-10-20T01:00:00Z"),
    );
    expect(clock.timeZone).toBe("America/Sao_Paulo");
    expect(clock.day()).toBe("2026-10-19");
    stored = "UTC";
    expect(clock.day()).toBe("2026-10-19"); // still cached
    await zone.refresh();
    expect(clock.timeZone).toBe("UTC");
    expect(clock.day()).toBe("2026-10-20");
    // Stale values reload in the background on read.
    stored = "Asia/Tokyo";
    now = 5000;
    zone.current();
    await new Promise((r) => setTimeout(r, 0));
    expect(clock.timeZone).toBe("Asia/Tokyo");
  });
});
