"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/shared/i18n";
import { Card, Crown, ListIcon } from "@/shared/icons";
import { CrosshairLoader, PageHeader, Panel } from "@/shared/ui";
import { useCheckout } from "../hooks/useCheckout";
import { useNow } from "@/shared/hooks";
import { useUsage } from "../hooks/useUsage";
import { isPaid } from "../model/plans";
import { BillingResult } from "./BillingResult";
import { CreditsPanel } from "./credits/CreditsPanel";
import { LedgerList } from "./credits/LedgerList";
import { useLedger } from "../hooks/useLedger";
import { useCredits } from "../hooks/useCredits";
import { PlanBadge } from "./PlanBadge";
import { UsageMeter } from "./UsageMeter";

/** /billing: checkout return states, current plan, today's usage and the portal. */
export function BillingScreen() {
  const { t, locale } = useI18n();
  const { plan, usage, refresh } = useUsage();
  const now = useNow();
  const { busy, error, manage } = useCheckout();
  const { credits } = useCredits();
  const ledger = useLedger();
  const [status, setStatus] = useState<"success" | "canceled" | null>(null);
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("status");
    setStatus(s === "success" || s === "canceled" ? s : null);
    // The webhook may land a moment after the redirect: refresh the account twice.
    void refresh();
    const id = setTimeout(() => {
      void refresh();
      if (s === "success") ledger.reload();
    }, 4000);
    return () => clearTimeout(id);
  }, [refresh]);
  const renews = plan?.renewsAt ? Date.parse(plan.renewsAt) : NaN;
  return (
    <main className="page narrow billing-page">
      {status ? (
        <BillingResult status={status} plan={plan} />
      ) : (
        <PageHeader
          eyebrow={t("Billing")}
          icon={<Card size={16} />}
          title={t("Your plan")}
        />
      )}
      <Panel icon={<Crown size={20} />} title={t("Plan & usage")}>
        <div className="billing-plan">
          <PlanBadge plan={plan} />
          {Number.isFinite(renews) && (
            <span className="muted small">
              {t("Renews on {date}", {
                date: new Date(renews).toLocaleDateString(locale, {
                  dateStyle: "medium",
                }),
              })}
            </span>
          )}
        </div>
        <div className="usage-stack">
          <UsageMeter kind="aiReviews" usage={usage} now={now} />
          <UsageMeter kind="liveAiMatches" usage={usage} now={now} />
          <UsageMeter kind="uploads" usage={usage} now={now} />
        </div>
        {error && (
          <p role="alert" className="form-error">
            {t(error)}
          </p>
        )}
        <div className="form-actions">
          {isPaid(plan) ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy !== null}
              onClick={manage}
            >
              {busy === "portal" ? (
                <CrosshairLoader size={18} />
              ) : (
                <Card size={18} />
              )}
              {t("Manage subscription")}
            </button>
          ) : null}
          <Link className="btn btn-primary" href="/pricing">
            <Crown size={18} />{" "}
            {isPaid(plan) ? t("Compare plans") : t("See plans")}
          </Link>
        </div>
      </Panel>
      <CreditsPanel history={false} />
      {credits && (
        <Panel
          id="credits"
          icon={<ListIcon size={20} />}
          title={t("Credit history")}
          sub={t("Every credit in and out of your account.")}
        >
          <LedgerList
            entries={ledger.entries}
            error={ledger.error}
            onRetry={ledger.reload}
          />
        </Panel>
      )}
    </main>
  );
}
