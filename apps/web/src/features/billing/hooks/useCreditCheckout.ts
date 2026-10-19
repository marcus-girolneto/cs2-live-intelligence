"use client";
import { useState } from "react";
import { useI18n } from "@/shared/i18n";
import { useBillingApi } from "../api/context";
import {
  checkoutErrorText,
  currencyFor,
  type CreditPack,
  type Plan,
} from "../model/plans";

/** Starts Stripe Checkout for a credit pack or a monthly plan; keeps busy/error state. */
export function useCreditCheckout() {
  const { lang } = useI18n();
  const api = useBillingApi();
  const currency = currencyFor(lang);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function go(id: string, url: () => Promise<string>) {
    setBusy(id);
    setError("");
    try {
      window.location.assign(await url());
    } catch (e) {
      setError(checkoutErrorText(e));
      setBusy(null);
    }
  }
  return {
    currency,
    busy,
    error,
    buyPack: (p: CreditPack) =>
      void go(p.id, () => api.buyCredits(p.id, currency)),
    upgrade: (p: Plan) =>
      void go(`plan:${p.id}`, () => api.startCheckout(p.id, "month", currency)),
  };
}
