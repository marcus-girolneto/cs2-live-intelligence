import { describe, expect, it } from "vitest";
import { FakeHttpClient } from "@/shared/http/FakeHttpClient";
import { normalizeCreditSettings, parseDelta } from "../model/credits";
import { createAdminApi } from "./admin.api";

describe("AdminApi credits", () => {
  it("reads and saves credit settings", async () => {
    const http = new FakeHttpClient()
      .on("GET", "admin/credits/settings", {
        settings: { welcomeCredits: 2, dailySafetyCap: 0 },
      })
      .on(
        "PUT",
        "admin/credits/settings",
        (c: { options: { json?: unknown } }) => c.options.json,
      );
    const api = createAdminApi(http);
    const s = await api.getCreditSettings();
    expect(s).toMatchObject({
      welcomeCredits: 2,
      dailySafetyCap: 30,
      deepCost: 3,
    });
    await api.saveCreditSettings({ ...s, quickCost: 2 });
    expect(http.calls[1]!.options.json).toMatchObject({ quickCost: 2 });
  });
  it("adjusts a user's credits with a note and reads their ledger", async () => {
    const http = new FakeHttpClient()
      .on("POST", "admin/users/u%2F1/credits", {})
      .on("GET", "admin/users/u1/ledger", { entries: [] });
    const api = createAdminApi(http);
    await api.adjustCredits("u/1", -2, "refund");
    expect(http.calls[0]!.options.json).toEqual({ delta: -2, note: "refund" });
    await api.getUserLedger("u1", 10);
    expect(http.calls[1]!.options.query).toEqual({ limit: 10 });
  });
  it("parses deltas and fills settings defaults", () => {
    expect(parseDelta("+5")).toBe(5);
    expect(parseDelta("-2")).toBe(-2);
    expect(parseDelta("0")).toBeUndefined();
    expect(parseDelta("1.5")).toBeUndefined();
    expect(normalizeCreditSettings({}).proDeepCost).toBe(2);
  });
});
