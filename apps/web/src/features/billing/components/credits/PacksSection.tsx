"use client";
import { useI18n } from "@/shared/i18n";
import { Bolt, Coin, Layers } from "@/shared/icons";
import { useCreditCheckout } from "../../hooks/useCreditCheckout";
import { usePacks } from "../../hooks/usePacks";
import { CreditPacks } from "./CreditPacks";

/** Pricing: "Credit packs": top up without a subscription; purchased credits never expire. */
export function PacksSection({
  signedIn,
  billingEnabled,
}: {
  signedIn: boolean;
  billingEnabled: boolean | null;
}) {
  const { t } = useI18n();
  const { packs, live } = usePacks();
  const { currency, busy, error, buyPack } = useCreditCheckout();
  const soon = billingEnabled === false || !live;
  return (
    <section className="packs-section" aria-labelledby="packs-title" id="packs">
      <h3 className="pricing-sub" id="packs-title">
        {t("Credit packs")}
      </h3>
      <p className="muted center">
        {t("No subscription needed. Purchased credits never expire.")}
      </p>
      <ul className="tier-legend" aria-label={t("What a credit buys")}>
        <li>
          <Bolt size={16} /> {t("Quick review")} <b>{t("{n} cr", { n: 1 })}</b>
        </li>
        <li>
          <Layers size={16} /> {t("Deep review")} <b>{t("{n} cr", { n: 3 })}</b>
          <small>{t("(2 on Pro)")}</small>
        </li>
        <li>
          <Coin size={16} /> {t("Opening a saved review")} <b>{t("Free")}</b>
        </li>
      </ul>
      <CreditPacks
        packs={packs}
        currency={currency}
        {...(signedIn ? { onBuy: buyPack } : {})}
        busy={busy}
        disabled={soon || billingEnabled === null}
      />
      {signedIn && soon && (
        <p className="soon-note center" role="status">
          {t("Coming soon. We're still setting up payments.")}
        </p>
      )}
      {error && (
        <p role="alert" className="form-error center">
          {t(error)}
        </p>
      )}
    </section>
  );
}
