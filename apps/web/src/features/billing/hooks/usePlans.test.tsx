// @vitest-environment happy-dom
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BillingApi } from "../api/billing.api";
import { BillingApiProvider } from "../api/context";
import { DEFAULT_PLANS, type Plan } from "../model/plans";
import { usePlans } from "./usePlans";

const live: Plan[] = [{ ...DEFAULT_PLANS[0]!, name: "Live free" }];
function fake(overrides: Partial<BillingApi> = {}): BillingApi {
  return {
    getPlans: vi.fn(async () => live),
    getBillingStatus: vi.fn(async () => ({ enabled: true })),
    startCheckout: vi.fn(async () => "https://x"),
    openPortal: vi.fn(async () => "https://x"),
    getLedger: vi.fn(async () => []),
    getPacks: vi.fn(async () => []),
    buyCredits: vi.fn(async () => "https://x"),
    ...overrides,
  };
}
const wrap =
  (api: BillingApi) =>
  ({ children }: { children: ReactNode }) => (
    <BillingApiProvider value={api}>{children}</BillingApiProvider>
  );

describe("usePlans", () => {
  it("loads live plans and billing status for signed-in accounts", async () => {
    const api = fake();
    const { result } = renderHook(() => usePlans(true), { wrapper: wrap(api) });
    expect(result.current.plans).toBe(DEFAULT_PLANS);
    expect(result.current.billingEnabled).toBeNull();
    await waitFor(() => expect(result.current.plans).toBe(live));
    await waitFor(() => expect(result.current.billingEnabled).toBe(true));
  });
  it("loads public plans signed out without asking for billing status", async () => {
    const api = fake();
    const { result } = renderHook(() => usePlans(false), {
      wrapper: wrap(api),
    });
    expect(result.current.billingEnabled).toBe(false);
    await waitFor(() => expect(result.current.plans).toBe(live));
    expect(api.getBillingStatus).not.toHaveBeenCalled();
  });
  it("keeps the published catalogue when the plans request fails", async () => {
    const api = fake({
      getPlans: vi.fn(async () => {
        throw new Error("down");
      }),
      getBillingStatus: vi.fn(async () => {
        throw new Error("down");
      }),
    });
    const { result } = renderHook(() => usePlans(true), { wrapper: wrap(api) });
    await waitFor(() => expect(result.current.billingEnabled).toBe(false));
    expect(result.current.plans).toBe(DEFAULT_PLANS);
  });
});
