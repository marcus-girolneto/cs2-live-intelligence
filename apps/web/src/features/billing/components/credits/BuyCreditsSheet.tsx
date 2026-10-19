"use client";
import Link from "next/link";
import { useI18n } from "@/shared/i18n";
import { ArrowRight, Coin, Crown } from "@/shared/icons";
import { CrosshairLoader, Dialog } from "@/shared/ui";
import { useCreditCheckout } from "../../hooks/useCreditCheckout";
import { useCredits } from "../../hooks/useCredits";
import { usePacks } from "../../hooks/usePacks";
import { usePlans } from "../../hooks/usePlans";
import { useUsage } from "../../hooks/useUsage";
import {
  formatPrice,
  type InsufficientCredits,
  type Plan,
} from "../../model/plans";
import { CreditPacks } from "./CreditPacks";

/**
 * Shown instead of an error when a review costs more credits than the balance (402
 * insufficient_credits), or from any "Buy credits" button: packs first, then plans.
 */
export function BuyCreditsSheet({
  info,
  onClose,
}: {
  info: InsufficientCredits;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { balance } = useCredits();
  const { plan } = useUsage();
  const { plans, billingEnabled } = usePlans();
  const fromApi = usePacks();
  const packs = info.packs.length ? info.packs : fromApi.packs;
  const live = info.packs.length > 0 || fromApi.live;
  const { currency, busy, error, buyPack, upgrade } = useCreditCheckout();
  const have = info.balance ?? balance;
  const short =
    info.needed !== null && have !== null
      ? Math.max(0, info.needed - have)
      : null;
  const order = plans.map((p) => p.id);
  const offers = plans.filter(
    (p) =>
      p.active &&
      p.prices[currency].month > 0 &&
      order.indexOf(p.id) > order.indexOf(plan?.id ?? "free"),
  );
  const soon = billingEnabled === false;
  return (
    <Dialog
      className="credits-sheet"
      title={
        <>
          <Coin size={20} />{" "}
          {short
            ? t("You need {n} more credits", { n: short })
            : t("Buy credits")}
        </>
      }
      sub={
        info.needed !== null
          ? t("This review costs {n} credits. Top up and run it right away.", {
              n: info.needed,
            })
          : t("Credits pay for AI reviews. Purchased credits never expire.")
      }
      onClose={onClose}
    >
      {have !== null && (
        <p className="cs-balance">
          <span>{t("Your balance")}</span>
          <b className="tabular">
            <Coin size={18} /> {have}
          </b>
        </p>
      )}
      <h3 className="cs-title">{t("Credit packs")}</h3>
      <CreditPacks
        packs={packs}
        currency={currency}
        onBuy={buyPack}
        busy={busy}
        disabled={soon || !live || billingEnabled === null}
        compact
      />
      {(soon || !live) && (
        <p className="soon-note" role="status">
          {t("Coming soon — payments are being set up.")}
        </p>
      )}
      {offers.length > 0 && (
        <>
          <h3 className="cs-title">{t("Or get credits every month")}</h3>
          <ul className="cs-plans">
            {offers.map((p) => (
              <PlanOffer
                key={p.id}
                plan={p}
                price={formatPrice(p.prices[currency].month, currency, locale)}
                busy={busy === `plan:${p.id}`}
                disabled={soon || busy !== null || billingEnabled === null}
                onChoose={() => upgrade(p)}
              />
            ))}
          </ul>
        </>
      )}
      {error && (
        <p role="alert" className="form-error">
          {t(error)}
        </p>
      )}
      <Link className="btn btn-ghost btn-sm" href="/pricing" onClick={onClose}>
        {t("Compare plans")} <ArrowRight size={16} />
      </Link>
    </Dialog>
  );
}

function PlanOffer({
  plan,
  price,
  busy,
  disabled,
  onChoose,
}: {
  plan: Plan;
  price: string;
  busy: boolean;
  disabled: boolean;
  onChoose: () => void;
}) {
  const { t } = useI18n();
  const l = plan.limits;
  return (
    <li className={`cs-plan ${plan.id === "pro" ? "pro" : ""}`}>
      <span className="cs-plan-name">
        <Crown size={18} /> {plan.name}
      </span>
      <span className="cs-plan-what">
        {l.monthlyCredits
          ? t("{n} credits every month", { n: l.monthlyCredits })
          : t("Monthly credits")}
        {l.deepCost !== null &&
          ` · ${t("Deep review for {n} credits", { n: l.deepCost })}`}
      </span>
      <span className="cs-plan-price">
        <b>{price}</b>
        <small>{t("/month")}</small>
      </span>
      <button
        type="button"
        className={`btn btn-sm ${plan.id === "pro" ? "btn-primary" : "btn-ghost"}`}
        disabled={disabled}
        onClick={onChoose}
      >
        {busy ? <CrosshairLoader size={16} /> : <Crown size={16} />}
        {t("Upgrade to {plan}", { plan: plan.name })}
      </button>
    </li>
  );
}
