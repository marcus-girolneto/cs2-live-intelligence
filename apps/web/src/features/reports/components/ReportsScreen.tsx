"use client";
import { useEffect } from "react";
import { useUpgrade, useUsage } from "@/features/billing";
import { useI18n } from "@/shared/i18n";
import { Crown, Lock, Medal, Sparkle } from "@/shared/icons";
import {
  Callout,
  CrosshairLoader,
  EmptyState,
  PageHeader,
  Skeleton,
} from "@/shared/ui";
import { useReports } from "../hooks/useReports";
import { periodLabel } from "../model/report";
import { SAMPLE_REPORT } from "../model/sample";
import { ReportView } from "./ReportView";

const thisMonth = () => new Date().toISOString().slice(0, 7);

/** /reports: monthly performance report (Pro) or a locked preview. */
export function ReportsScreen() {
  const { t, locale } = useI18n();
  const { limits, isAdmin } = useUsage();
  const upgrade = useUpgrade();
  const pro = isAdmin || !!limits?.monthlyReport;
  const r = useReports(pro);
  const { select } = r;
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) select(id);
  }, [select]);
  const hasCurrent = r.list?.some((x) => x.period === thisMonth()) ?? false;
  const generate = (
    <button
      type="button"
      className="btn btn-primary"
      disabled={r.generating}
      onClick={() => void r.generate()}
    >
      {r.generating ? <CrosshairLoader size={18} /> : <Sparkle size={18} />}
      {hasCurrent
        ? t("Refresh this month's report")
        : t("Generate this month's report")}
    </button>
  );
  return (
    <main className="page reports-page">
      <PageHeader
        eyebrow={t("Reports")}
        icon={<Medal size={16} />}
        title={t("Your month in review")}
        lead={t(
          "Trends, per-map form, recurring mistakes, utility and crosshair evolution, your best and worst match, and a plan for next month.",
        )}
        actions={pro ? generate : undefined}
      />
      {!pro ? (
        <section className="report-locked" data-testid="report-teaser">
          <div className="rl-preview" aria-hidden="true" inert>
            <ReportView r={SAMPLE_REPORT} share={false} />
          </div>
          <div className="rl-overlay">
            <div className="dt-card">
              <span className="dt-lock" aria-hidden>
                <Lock size={22} />
              </span>
              <h2>{t("Monthly reports are a Pro feature")}</h2>
              <p className="muted">
                {t(
                  "Every month: trends, per-map form, recurring mistakes and a plan, in one report you can share.",
                )}
              </p>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() =>
                  upgrade.open({ feature: "monthly_report", limit: 0 })
                }
              >
                <Crown size={20} /> {t("Get it with Pro")}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          {r.error && (
            <Callout tone="error" role="alert">
              {t(r.error)}
            </Callout>
          )}
          {r.generating && (
            <Callout
              tone="info"
              role="status"
              title={t("Writing your report…")}
            >
              <p>
                {t(
                  "The coach is reading every match of the month. This can take a minute.",
                )}
              </p>
            </Callout>
          )}
          {r.list === null ? (
            <Skeleton height={320} />
          ) : r.list.length === 0 ? (
            <EmptyState
              icon={<Medal size={28} />}
              title={t("No reports yet")}
              actions={generate}
            >
              <p>
                {t(
                  "Generate your first monthly report from the matches you analyzed this month.",
                )}
              </p>
            </EmptyState>
          ) : (
            <>
              {r.list.length > 1 && (
                <div
                  className="segmented report-periods"
                  role="group"
                  aria-label={t("Report month")}
                >
                  {r.list.map((x) => (
                    <button
                      key={x.id}
                      type="button"
                      aria-pressed={r.selected === x.id}
                      onClick={() => r.select(x.id)}
                    >
                      {periodLabel(x.period, locale) || x.id}
                    </button>
                  ))}
                </div>
              )}
              {r.loading || !r.report ? (
                <Skeleton height={420} />
              ) : (
                <ReportView r={r.report} />
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
