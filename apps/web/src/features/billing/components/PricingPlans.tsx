"use client";
import type { ReactNode } from "react";
import { useI18n } from "@/shared/i18n";
import { Check, Crown } from "@/shared/icons";
import { CrosshairLoader } from "@/shared/ui";
import {
  formatPrice,
  freeMonths,
  type Currency,
  type Interval,
  type Plan,
  type PlanId,
} from "../model/plans";
import { PlanFeatures } from "./PlanFeatures";

/** Monthly / yearly switch ("2 months free"). */
export function IntervalToggle({
  value,
  onChange,
}: {
  value: Interval;
  onChange: (v: Interval) => void;
}) {
  const { t } = useI18n();
  return (
    <div
      className="segmented interval-toggle"
      role="group"
      aria-label={t("Billing period")}
    >
      <button
        type="button"
        aria-pressed={value === "month"}
        onClick={() => onChange("month")}
      >
        {t("Monthly")}
      </button>
      <button
        type="button"
        aria-pressed={value === "year"}
        onClick={() => onChange("year")}
      >
        {t("Yearly")} <span className="chip good">{t("2 months free")}</span>
      </button>
    </div>
  );
}

/** Three plan cards; Pro is highlighted as the most popular. */
export function PricingPlans({
  plans,
  interval,
  currency,
  currentPlan,
  billingEnabled,
  busy,
  onChoose,
  onManage,
  signIn,
}: {
  plans: Plan[];
  interval: Interval;
  currency: Currency;
  /** null when signed out. */
  currentPlan: PlanId | null;
  billingEnabled: boolean | null;
  busy: PlanId | null;
  onChoose: (plan: Plan) => void;
  /** Paid users change plans in the billing portal. */
  onManage: () => void;
  /** CTA rendered for signed-out visitors (Steam sign-in). */
  signIn?: ReactNode;
}) {
  const { t, locale } = useI18n();
  const visible = plans.filter((p) => p.active);
  return (
    <div className="pricing-grid">
      {visible.map((plan) => {
        const price = plan.prices[currency];
        const free = price.month === 0;
        const amount =
          interval === "year" && !free ? price.year / 12 : price.month;
        const popular = plan.id === "pro";
        const current = currentPlan === plan.id;
        return (
          <article
            key={plan.id}
            className={`price-card ${popular ? "popular" : ""} ${current ? "current" : ""}`}
            aria-label={plan.name}
          >
            {popular && (
              <span className="price-ribbon">{t("Most popular")}</span>
            )}
            <header>
              <h3>
                {plan.id !== "free" && <Crown size={20} />} {plan.name}
              </h3>
              <p className="price">
                <b>
                  {free
                    ? formatPrice(0, currency, locale).replace(/[.,]00$/, "")
                    : formatPrice(Math.round(amount), currency, locale)}
                </b>
                <small>{t("/month")}</small>
              </p>
              <p className="price-note">
                {free
                  ? t("Free forever")
                  : interval === "year"
                    ? t("{price} billed yearly — {n} months free", {
                        price: formatPrice(price.year, currency, locale),
                        n: freeMonths(price),
                      })
                    : t("Billed monthly · cancel anytime")}
              </p>
            </header>
            <PlanFeatures limits={plan.limits} />
            <footer>
              {currentPlan === null ? (
                (signIn ?? null)
              ) : current ? (
                <span
                  className="btn btn-ghost btn-block is-current"
                  aria-disabled
                >
                  <Check size={18} /> {t("Your current plan")}
                </span>
              ) : free ? (
                <span className="muted small">
                  {t("Included with every account")}
                </span>
              ) : currentPlan !== "free" ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-block"
                  disabled={busy !== null}
                  onClick={onManage}
                >
                  {t("Switch to {plan}", { plan: plan.name })}
                </button>
              ) : billingEnabled === false ? (
                <p className="soon-note">
                  {t("Coming soon — payments are being set up.")}
                </p>
              ) : (
                <button
                  type="button"
                  className={`btn btn-block ${popular ? "btn-primary" : "btn-ghost"}`}
                  disabled={busy !== null || billingEnabled === null}
                  onClick={() => onChoose(plan)}
                >
                  {busy === plan.id ? (
                    <CrosshairLoader size={18} />
                  ) : (
                    <Crown size={18} />
                  )}
                  {t("Upgrade to {plan}", { plan: plan.name })}
                </button>
              )}
            </footer>
          </article>
        );
      })}
    </div>
  );
}
