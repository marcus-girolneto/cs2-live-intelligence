import { describe, expect, it } from "vitest";
import { FakeHttpClient } from "@/shared/http/FakeHttpClient";
import { createAdminApi } from "../api/admin.api";
import {
  normalizeIntegrations,
  normalizeIntegrationTest,
  secretProblem,
  webhookUrl,
} from "./integrations";

describe("integrations", () => {
  it("normalizes the status defensively and never exposes full secrets", () => {
    const i = normalizeIntegrations({
      steam: { configured: true, source: "env", last4: "ABCD" },
      stripe: {
        configured: true,
        secretKeyLast4: "sk_live_full_secret_value",
        webhookConfigured: true,
        publishableKey: "pk_test_123",
        enabled: true,
      },
    });
    expect(i.steam).toEqual({
      configured: true,
      source: "env",
      last4: "ABCD",
      updatedAt: null,
    });
    expect(i.stripe.source).toBe("database");
    expect(i.stripe.secretKeyLast4).toBeNull();
    expect(i.stripe.publishableKey).toBe("pk_test_123");
    expect(normalizeIntegrations(null).steam.source).toBe("none");
    expect(
      normalizeIntegrations({ stripe: { publishableKey: "sk_live_x" } }).stripe
        .publishableKey,
    ).toBeNull();
  });
  it("reads test results and validates key formats", () => {
    expect(
      normalizeIntegrationTest({ ok: true, latencyMs: 120.4, livemode: false }),
    ).toEqual({ ok: true, latencyMs: 120, detail: null, livemode: false });
    expect(normalizeIntegrationTest({ latencyMs: -1 }).latencyMs).toBeNull();
    expect(
      secretProblem("steam", "0123456789abcdef0123456789ABCDEF"),
    ).toBeNull();
    expect(secretProblem("steam", "short")).toMatch(/32/);
    expect(secretProblem("stripe_secret", "sk_test_abc")).toBeNull();
    expect(secretProblem("stripe_secret", "pk_test_abc")).toMatch(/sk_/);
    expect(secretProblem("stripe_webhook", "whsec_1")).toBeNull();
    expect(secretProblem("stripe_publishable", "pk_live_1")).toBeNull();
    expect(secretProblem("steam", " ")).toBe("Enter a value.");
    expect(webhookUrl("https://api.example.com/")).toBe(
      "https://api.example.com/v1/billing/webhook",
    );
    expect(webhookUrl("nope")).toBeNull();
  });
  it("calls the integration routes with exact bodies", async () => {
    const http = new FakeHttpClient()
      .on("GET", "admin/integrations", { steam: { configured: false } })
      .on("PUT", "admin/integrations/steam", {})
      .on("PUT", "admin/integrations/stripe", {})
      .on("POST", "admin/integrations/stripe/test", {
        ok: true,
        livemode: true,
      });
    const api = createAdminApi(http);
    expect((await api.getIntegrations()).steam.configured).toBe(false);
    await api.saveSteam(null);
    await api.saveStripe({ enabled: false });
    const r = await api.testIntegration("stripe");
    expect(r.livemode).toBe(true);
    expect(http.calls.map((c) => [c.method, c.path, c.options.json])).toEqual([
      ["GET", "admin/integrations", undefined],
      ["PUT", "admin/integrations/steam", { webApiKey: null }],
      ["PUT", "admin/integrations/stripe", { enabled: false }],
      ["POST", "admin/integrations/stripe/test", {}],
    ]);
  });
});
