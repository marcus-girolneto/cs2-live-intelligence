// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { FakeHttpClient } from "@/shared/http/FakeHttpClient";
import { DEFAULT_PLANS } from "../model/plans";
import { createBillingApi, safeRedirect } from "./billing.api";

describe("BillingApi", () => {
  it("reads and normalises the plan catalogue", async () => {
    const http = new FakeHttpClient().on("GET", "plans", {
      plans: [
        {
          id: "pro",
          name: "Pro+",
          prices: { USD: { month: 999, year: 9990 } },
        },
      ],
    });
    const plans = await createBillingApi(http).getPlans();
    expect(plans).toHaveLength(1);
    expect(plans[0]!.name).toBe("Pro+");
    expect(plans[0]!.prices.USD.month).toBe(999);
    expect(http.calls[0]).toMatchObject({ method: "GET", path: "plans" });
  });
  it("falls back to the published catalogue for an empty answer", async () => {
    const http = new FakeHttpClient().on("GET", "plans", { plans: [] });
    expect(await createBillingApi(http).getPlans()).toBe(DEFAULT_PLANS);
  });
  it("only reports billing enabled when the API says true", async () => {
    const api = (body: unknown) =>
      createBillingApi(new FakeHttpClient().on("GET", "billing/status", body));
    expect(await api({ enabled: true }).getBillingStatus()).toEqual({
      enabled: true,
    });
    expect(await api({ enabled: "yes" }).getBillingStatus()).toEqual({
      enabled: false,
    });
    expect(await api(undefined).getBillingStatus()).toEqual({ enabled: false });
  });
  it("posts checkout and portal requests and validates the redirect", async () => {
    const http = new FakeHttpClient()
      .on("POST", "billing/checkout", { url: "https://checkout.stripe.com/x" })
      .on("POST", "billing/portal", { url: "javascript:alert(1)" });
    const api = createBillingApi(http);
    await expect(api.startCheckout("pro", "year", "BRL")).resolves.toBe(
      "https://checkout.stripe.com/x",
    );
    expect(http.calls[0]!.options.json).toEqual({
      planId: "pro",
      interval: "year",
      currency: "BRL",
    });
    await expect(api.openPortal()).rejects.toThrow("Checkout is unavailable.");
    expect(http.calls[1]!.options.json).toEqual({});
  });
  it("accepts https and same-origin redirects only", () => {
    const origin = "http://127.0.0.1:3000";
    expect(safeRedirect("/billing?status=success", origin)).toBe(
      "http://127.0.0.1:3000/billing?status=success",
    );
    expect(() => safeRedirect("http://evil.test/", origin)).toThrow();
    expect(() => safeRedirect(42, origin)).toThrow();
  });
});
