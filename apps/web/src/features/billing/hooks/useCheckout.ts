"use client";
import { useState } from "react";
import { useBillingApi } from "../api/context";
import {
  checkoutErrorText,
  type Currency,
  type Interval,
  type Plan,
  type PlanId,
} from "../model/plans";

/** Starts Stripe Checkout / Customer Portal and redirects the browser. */
export function useCheckout() {
  const api = useBillingApi();
  const [busy, setBusy] = useState<PlanId | "portal" | null>(null);
  const [error, setError] = useState("");
  async function go(key: PlanId | "portal", get: () => Promise<string>) {
    setBusy(key);
    setError("");
    try {
      window.location.assign(await get());
    } catch (e) {
      setError(checkoutErrorText(e));
      setBusy(null);
    }
  }
  return {
    busy,
    error,
    checkout: (plan: Plan, interval: Interval, currency: Currency) =>
      void go(plan.id, () => api.startCheckout(plan.id, interval, currency)),
    manage: () => void go("portal", () => api.openPortal()),
  };
}
