import { describe, expect, it } from "vitest";
import {
  FakeHttpClient,
  type RecordedCall,
} from "@/shared/http/FakeHttpClient";
import { createDevelopersApi } from "./developers.api";

describe("DevelopersApi", () => {
  it("creates, lists and revokes API keys through the session routes", async () => {
    const http = new FakeHttpClient()
      .on("GET", "me/api-keys", { keys: [], maxActive: 10 })
      .on("POST", "me/api-keys", (call: RecordedCall) => ({
        ...(call.options.json as object),
        key: "fm_live_x",
      }))
      .on("DELETE", "me/api-keys/k%2F1", undefined);
    const api = createDevelopersApi(http);
    await expect(api.listKeys()).resolves.toMatchObject({ maxActive: 10 });
    const created = await api.createKey({
      name: "CI",
      scopes: ["matches:read"],
      expiresInDays: 30,
    });
    expect(created).toMatchObject({ name: "CI", key: "fm_live_x" });
    await api.revokeKey("k/1");
    expect(http.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      "GET me/api-keys",
      "POST me/api-keys",
      "DELETE me/api-keys/k%2F1",
    ]);
  });
  it("manages webhooks, tests a delivery and reads recent deliveries", async () => {
    const http = new FakeHttpClient()
      .on("GET", "me/webhooks", { webhooks: [{ id: "w1" }] })
      .on("POST", "me/webhooks", { id: "w2", secret: "whsec_x" })
      .on("POST", "me/webhooks/w2/test", {
        delivered: true,
        status: 200,
        error: null,
      })
      .on("GET", "me/webhooks/deliveries", { deliveries: [{ id: "d1" }] })
      .on("DELETE", "me/webhooks/w2", undefined);
    const api = createDevelopersApi(http);
    expect(await api.listWebhooks()).toEqual([{ id: "w1" }]);
    await api.createWebhook("https://example.com/h", ["demo.completed"]);
    expect(http.calls[1]!.options.json).toEqual({
      url: "https://example.com/h",
      events: ["demo.completed"],
    });
    expect((await api.testWebhook("w2")).delivered).toBe(true);
    expect(await api.deliveries(5)).toEqual([{ id: "d1" }]);
    expect(http.calls[3]!.options.query).toEqual({ limit: 5 });
    await api.deleteWebhook("w2");
  });
});
