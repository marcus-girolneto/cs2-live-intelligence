"use client";
import Link from "next/link";
import { useI18n } from "@/shared/i18n";
import { ArrowRight, Check, Close, Crown } from "@/shared/icons";
import type { AccountPlan } from "../model/plans";
import { PlanBadge } from "./PlanBadge";

/** Landing state after Stripe Checkout (?status=success|canceled). */
export function BillingResult({
  status,
  plan,
}: {
  status: "success" | "canceled" | null;
  plan: AccountPlan | null;
}) {
  const { t } = useI18n();
  if (status === "success")
    return (
      <div className="billing-result good" role="status">
        <span className="br-icon">
          <Check size={34} />
        </span>
        <h1>{t("You're in. GG!")}</h1>
        <p className="lead">
          {t(
            "Your subscription is active. It can take a few seconds to show up everywhere.",
          )}
        </p>
        <p>
          <PlanBadge plan={plan} />
        </p>
        <div className="br-actions">
          <Link className="btn btn-primary btn-lg" href="/coach">
            <Crown size={20} /> {t("Open the coach")}
          </Link>
          <Link className="btn btn-ghost" href="/">
            {t("Back to dashboard")} <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  if (status === "canceled")
    return (
      <div className="billing-result" role="status">
        <span className="br-icon">
          <Close size={34} />
        </span>
        <h1>{t("Checkout canceled")}</h1>
        <p className="lead">
          {t("No charge was made. You can upgrade whenever you want.")}
        </p>
        <div className="br-actions">
          <Link className="btn btn-primary" href="/pricing">
            {t("See plans")}
          </Link>
          <Link className="btn btn-ghost" href="/">
            {t("Back to dashboard")}
          </Link>
        </div>
      </div>
    );
  return null;
}
