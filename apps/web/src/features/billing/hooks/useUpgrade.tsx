"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { useI18n } from "@/shared/i18n";
import { useBillingApi } from "../api/context";
import { UpgradeSheet } from "../components/UpgradeSheet";
import {
  checkoutErrorText,
  currencyFor,
  planLimitFrom,
  upgradeTarget,
  type Plan,
  type PlanLimitError,
} from "../model/plans";
import { usePlans } from "./usePlans";
import { useUsage } from "./useUsage";

type Ctx = {
  /** Opens the upgrade sheet for a limit or a locked feature. */
  open: (info: PlanLimitError) => void;
  /** Opens the sheet when `error` is a 402 plan_limit; returns true when handled. */
  handle: (error: unknown) => boolean;
};
const UpgradeContext = createContext<Ctx>({
  open: () => {},
  handle: () => false,
});
export const useUpgrade = () => useContext(UpgradeContext);

/** Holds the single upgrade sheet of the signed-in app. */
export function UpgradeProvider({ children }: { children: React.ReactNode }) {
  const [info, setInfo] = useState<PlanLimitError | null>(null);
  const open = useCallback((i: PlanLimitError) => setInfo(i), []);
  const handle = useCallback((e: unknown) => {
    const limit = planLimitFrom(e);
    if (limit) setInfo(limit);
    return !!limit;
  }, []);
  return (
    <UpgradeContext.Provider value={{ open, handle }}>
      {children}
      {info && (
        <UpgradeSheetContainer info={info} onClose={() => setInfo(null)} />
      )}
    </UpgradeContext.Provider>
  );
}

function UpgradeSheetContainer({
  info,
  onClose,
}: {
  info: PlanLimitError;
  onClose: () => void;
}) {
  const { lang } = useI18n();
  const api = useBillingApi();
  const { plans, billingEnabled } = usePlans();
  const { plan } = useUsage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const currency = currencyFor(lang);
  async function checkout(target: Plan) {
    setBusy(true);
    setError("");
    try {
      window.location.assign(
        await api.startCheckout(target.id, "month", currency),
      );
    } catch (e) {
      setError(checkoutErrorText(e));
      setBusy(false);
    }
  }
  return (
    <UpgradeSheet
      info={info}
      target={upgradeTarget(plans, plan?.id, info.upgradeTo, info.feature)}
      currency={currency}
      billingEnabled={billingEnabled}
      busy={busy}
      error={error}
      onCheckout={(p) => void checkout(p)}
      onClose={onClose}
    />
  );
}
