import { describe, expect, it } from "vitest";
import { FakeHttpClient } from "@/shared/http/FakeHttpClient";
import { createSettingsApi } from "./settings.api";

describe("SettingsApi", () => {
  it("rotates and revokes devices with encoded ids", async () => {
    const http = new FakeHttpClient()
      .on("POST", "devices/d%2F1/rotate", { code: "c", expiresAt: "x" })
      .on("DELETE", "devices/d%2F1", undefined);
    const api = createSettingsApi(http, new FakeHttpClient());
    await expect(api.rotateDevice("d/1")).resolves.toEqual({
      code: "c",
      expiresAt: "x",
    });
    await api.revokeDevice("d/1");
    expect(http.calls.map((c) => c.method)).toEqual(["POST", "DELETE"]);
  });
  it("deletes the account then clears the session", async () => {
    const http = new FakeHttpClient().on("DELETE", "account", undefined);
    const web = new FakeHttpClient().on("POST", "logout", undefined);
    await createSettingsApi(http, web).deleteAccount();
    expect(web.calls).toHaveLength(1);
  });
});
