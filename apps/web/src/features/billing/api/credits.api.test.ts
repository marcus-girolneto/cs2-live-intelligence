// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { FakeHttpClient } from "@/shared/http/FakeHttpClient";
import { createBillingApi } from "./billing.api";

describe("BillingApi credits", () => {
  it("reads the ledger with a limit and the packs", async () => {
    const http = new FakeHttpClient()
      .on("GET", "credits/ledger", { entries: [] })
      .on("GET", "credits/packs", {
        packs: [{ id: "p", credits: 5, prices: { USD: 299, BRL: 990 } }],
      });
    const api = createBillingApi(http);
    await api.getLedger(20);
    expect(http.calls[0]!.options.query).toEqual({ limit: 20 });
    expect((await api.getPacks())[0]!.id).toBe("p");
  });
  it("starts a pack checkout and only follows https", async () => {
    const http = new FakeHttpClient().on("POST", "billing/credits/checkout", {
      url: "https://checkout.stripe.com/x",
    });
    await expect(createBillingApi(http).buyCredits("p5", "BRL")).resolves.toBe(
      "https://checkout.stripe.com/x",
    );
    expect(http.calls[0]!.options.json).toEqual({
      packId: "p5",
      currency: "BRL",
    });
    const bad = new FakeHttpClient().on("POST", "billing/credits/checkout", {
      url: "javascript:alert(1)",
    });
    await expect(
      createBillingApi(bad).buyCredits("p5", "USD"),
    ).rejects.toThrow();
  });
});
