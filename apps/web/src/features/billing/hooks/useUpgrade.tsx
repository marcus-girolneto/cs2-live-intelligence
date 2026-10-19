"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { useI18n } from "@/shared/i18n";
import { useBillingApi } from "../api/context";
import { BuyCreditsSheet } from "../components/credits/BuyCreditsSheet";
import { UpgradeSheet } from "../components/UpgradeSheet";
import {
  checkoutErrorText,
  currencyFor,
  insufficientFrom,
  planLimitFrom,
  upgradeTarget,
  type InsufficientCredits,
  type Plan,
  type PlanLimitError,
} from "../model/plans";
import { usePlans } from "./usePlans";
import { useUsage } from "./useUsage";

type Ctx = {
  /** Opens the upgrade sheet for a limit or a locked feature. */
  open: (info: PlanLimitError) => void;
  /** Opens the "buy credits" sheet (packs + plans). */
  openCredits: (info?: Partial<InsufficientCredits>) => void;
  /**
   * Opens the right sheet when `error` is a 402 plan_limit or insufficient_credits;
   * returns true when handled.
   */
  handle: (error: unknown) => boolean;
};
const UpgradeContext = createContext<Ctx>({
  open: () => {},
  openCredits: () => {},
  handle: () => false,
});
export const useUpgrade = () => useContext(UpgradeContext);

type Sheet =
  | { kind: "plan"; info: PlanLimitError }
  | { kind: "credits"; info: InsufficientCredits };

/** Holds the single upgrade / buy-credits sheet of the signed-in app. */
export function UpgradeProvider({ children }: { children: React.ReactNode }) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const open = useCallback(
    (info: PlanLimitError) => setSheet({ kind: "plan", info }),
    [],
  );
  const openCredits = useCallback(
    (info: Partial<InsufficientCredits> = {}) =>
      setSheet({
        kind: "credits",
        info: { needed: null, balance: null, packs: [], ...info },
      }),
    [],
  );
  const handle = useCallback((e: unknown) => {
    const credits = insufficientFrom(e);
    if (credits) {
      setSheet({ kind: "credits", info: credits });
      return true;
    }
    const limit = planLimitFrom(e);
    if (limit) setSheet({ kind: "plan", info: limit });
    return !!limit;
  }, []);
  const close = useCallback(() => setSheet(null), []);
  return (
    <UpgradeContext.Provider value={{ open, openCredits, handle }}>
      {children}
      {sheet?.kind === "plan" && (
        <UpgradeSheetContainer info={sheet.info} onClose={close} />
      )}
      {sheet?.kind === "credits" && (
        <BuyCreditsSheet info={sheet.info} onClose={close} />
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
