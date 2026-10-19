import { describe, expect, it } from "vitest";
import { FakeHttpClient } from "@/shared/http/FakeHttpClient";
import { createAdminApi } from "./admin.api";

describe("AdminApi", () => {
  it("creates or updates a provider", async () => {
    const http = new FakeHttpClient()
      .on("POST", "admin/ai/providers", undefined)
      .on("PUT", "admin/ai/providers/p%201", undefined);
    const api = createAdminApi(http);
    await api.saveProvider(null, { name: "a" });
    await api.saveProvider("p 1", { name: "b" });
    expect(http.calls.map((c) => [c.method, c.path])).toEqual([
      ["POST", "admin/ai/providers"],
      ["PUT", "admin/ai/providers/p%201"],
    ]);
  });
  it("tests the live purpose with the AI timeout", async () => {
    const http = new FakeHttpClient().on("POST", "ai/test", { ok: true });
    await createAdminApi(http).testActive("live");
    expect(http.calls[0]!.options).toMatchObject({
      json: { purpose: "live" },
      timeoutMs: 600000,
    });
  });
  it("sets a user plan with an optional end date", async () => {
    const http = new FakeHttpClient().on("PUT", "admin/users/u/plan", {});
    await createAdminApi(http).setUserPlan("u", "pro");
    expect(http.calls[0]!.options.json).toEqual({ planId: "pro" });
  });
});
