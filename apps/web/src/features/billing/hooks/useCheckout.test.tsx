// @vitest-environment happy-dom
import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/http";
import type { BillingApi } from "../api/billing.api";
import { BillingApiProvider } from "../api/context";
import { DEFAULT_PLANS } from "../model/plans";
import { useCheckout } from "./useCheckout";

const wrap =
  (api: BillingApi) =>
  ({ children }: { children: ReactNode }) => (
    <BillingApiProvider value={api}>{children}</BillingApiProvider>
  );
afterEach(() => vi.unstubAllGlobals());

describe("useCheckout", () => {
  it("redirects to the checkout URL", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    const api: BillingApi = {
      getPlans: vi.fn(),
      getBillingStatus: vi.fn(),
      startCheckout: vi.fn(async () => "https://checkout.stripe.com/s"),
      openPortal: vi.fn(),
    };
    const { result } = renderHook(() => useCheckout(), { wrapper: wrap(api) });
    act(() => result.current.checkout(DEFAULT_PLANS[1]!, "month", "USD"));
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/s"),
    );
    expect(api.startCheckout).toHaveBeenCalledWith(
      DEFAULT_PLANS[1]!.id,
      "month",
      "USD",
    );
  });
  it("shows the billing-disabled text and clears busy on failure", async () => {
    const api: BillingApi = {
      getPlans: vi.fn(),
      getBillingStatus: vi.fn(),
      startCheckout: vi.fn(),
      openPortal: vi.fn(async () => {
        throw new ApiError("x", 503, "billing_disabled");
      }),
    };
    const { result } = renderHook(() => useCheckout(), { wrapper: wrap(api) });
    act(() => result.current.manage());
    await waitFor(() =>
      expect(result.current.error).toBe(
        "Coming soon — payments are being set up.",
      ),
    );
    expect(result.current.busy).toBeNull();
  });
});
