"use client";
import { useState, type ReactNode } from "react";
import { useI18n } from "@/shared/i18n";
import { Card } from "@/shared/icons";
import { CrosshairLoader } from "@/shared/ui";
import { useCheckout } from "../hooks/useCheckout";
import { usePlans } from "../hooks/usePlans";
import { currencyFor, type AccountPlan, type Interval } from "../model/plans";
import { PacksSection } from "./credits/PacksSection";
import { PlanComparison, PricingFaq } from "./PlanComparison";
import { IntervalToggle, PricingPlans } from "./PricingPlans";

/**
 * Plans, comparison table and FAQ. Signed-out visitors get `signIn` as the CTA; signed-in
 * users go to checkout (or see "coming soon" when payments are not configured).
 */
export function PricingSection({
  signedIn,
  plan,
  signIn,
  headingLevel = 2,
  showFaq = true,
}: {
  signedIn: boolean;
  plan: AccountPlan | null;
  signIn?: ReactNode;
  headingLevel?: 1 | 2;
  showFaq?: boolean;
}) {
  const { t, lang } = useI18n();
  const [interval, setPeriod] = useState<Interval>("month");
  const { plans, billingEnabled } = usePlans(signedIn);
  const { busy, error, checkout, manage } = useCheckout();
  const currency = currencyFor(lang);
  const H = headingLevel === 1 ? "h1" : "h2";
  const paid = !!plan && plan.id !== "free";
  return (
    <section className="pricing" aria-labelledby="pricing-title">
      <div className="ls-head">
        <span className="eyebrow">{t("Plans")}</span>
        <H id="pricing-title">{t("Pick your rank")}</H>
        <p className="lead">
          {t(
            "Start with a free review. Plans add monthly credits, cheaper Deep reviews, the live AI IGL, reports and video clips.",
          )}
        </p>
        <div className="pricing-tools">
          <IntervalToggle value={interval} onChange={setPeriod} />
          {signedIn && paid && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={busy !== null}
              onClick={manage}
            >
              {busy === "portal" ? (
                <CrosshairLoader size={16} />
              ) : (
                <Card size={16} />
              )}
              {t("Manage subscription")}
            </button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="form-error center">
          {t(error)}
        </p>
      )}
      <PricingPlans
        plans={plans}
        interval={interval}
        currency={currency}
        currentPlan={signedIn ? (plan?.id ?? "free") : null}
        billingEnabled={billingEnabled}
        busy={busy === "portal" ? null : busy}
        onChoose={(p) => checkout(p, interval, currency)}
        onManage={manage}
        {...(signIn ? { signIn } : {})}
      />
      <h3 className="pricing-sub">{t("Compare plans")}</h3>
      <PlanComparison plans={plans} />
      <PacksSection signedIn={signedIn} billingEnabled={billingEnabled} />
      {showFaq && (
        <>
          <h3 className="pricing-sub">{t("Questions")}</h3>
          <PricingFaq />
        </>
      )}
    </section>
  );
}
