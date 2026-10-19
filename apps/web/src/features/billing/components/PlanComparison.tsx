"use client";
import { useI18n } from "@/shared/i18n";
import { Check, Close } from "@/shared/icons";
import type { Plan, PlanLimits } from "../model/plans";

type Row = { label: string; value: (l: PlanLimits) => string | boolean };

/** Feature-by-plan table (scrolls horizontally inside its wrapper on phones). */
export function PlanComparison({ plans }: { plans: Plan[] }) {
  const { t } = useI18n();
  const n = (v: number | null) => (v === null ? "∞" : String(v));
  const capped = plans.some((p) => p.limits.aiReviewsPerDay !== null);
  const rows: Row[] = [
    {
      label: t("Credits every month"),
      value: (l) =>
        l.monthlyCredits ? n(l.monthlyCredits) : t("Welcome credit"),
    },
    {
      label: t("Deep review cost"),
      value: (l) =>
        l.deepCost === null ? "—" : t("{n} credits", { n: l.deepCost }),
    },
    ...(capped
      ? [
          {
            label: t("AI Coach reviews per day"),
            value: (l: PlanLimits) => n(l.aiReviewsPerDay),
          },
        ]
      : []),
    {
      label: t("Live AI IGL matches per day"),
      value: (l) =>
        (l.liveAiMatchesPerDay ?? 1) > 0
          ? n(l.liveAiMatchesPerDay)
          : t("Rule tips"),
    },
    { label: t("Demo uploads per day"), value: (l) => n(l.uploadsPerDay) },
    {
      label: t("Match history"),
      value: (l) =>
        l.retentionDays === null
          ? "∞"
          : l.retentionDays >= 365
            ? t("1 year")
            : t("{n} days", { n: l.retentionDays }),
    },
    { label: t("Watch 2D clips"), value: () => true },
    { label: t("Clip video export"), value: (l) => l.clipExport },
    { label: t("Per-map deep learning"), value: (l) => l.perMapLearning },
    { label: t("Monthly performance report"), value: (l) => l.monthlyReport },
    { label: t("Personal Coach"), value: (l) => l.personalCoach },
    { label: t("Match reel"), value: (l) => l.matchReel },
    { label: t("History compare"), value: (l) => l.historyCompare },
    { label: t("Priority processing"), value: (l) => l.priorityQueue },
  ];
  const visible = plans.filter((p) => p.active);
  return (
    <div className="table-wrap">
      <table className="table compare">
        <caption className="visually-hidden">{t("Compare plans")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("Feature")}</th>
            {visible.map((p) => (
              <th key={p.id} scope="col" className={p.id === "pro" ? "hl" : ""}>
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              {visible.map((p) => {
                const v = r.value(p.limits);
                return (
                  <td key={p.id} className={p.id === "pro" ? "hl" : ""}>
                    {v === true ? (
                      <Check size={18} className="yes" title={t("Included")} />
                    ) : v === false ? (
                      <Close
                        size={16}
                        className="no"
                        title={t("Not included")}
                      />
                    ) : (
                      v
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const FAQ = [
  {
    q: "What's a credit?",
    a: "Credits pay for AI reviews: a Quick review costs 1 credit, a Deep review 3 (2 on Pro). Opening a review you already have is always free.",
  },
  {
    q: "Quick or Deep review?",
    a: "Quick gives the verdict, scores, key moments and a plan. Deep uses a stronger AI and adds the utility lab, crosshair placement, positioning, a round-by-round table and up to 10 key moments.",
  },
  {
    q: "Do credits expire?",
    a: "Plan credits are refilled every month and expire at renewal. Purchased credits never expire. The welcome credit stays until you use it.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel in one click from Manage subscription; you keep your plan until the end of the period you paid for.",
  },
  {
    q: "How can I pay?",
    a: "Card worldwide, and Pix in Brazil. Prices are shown in reais in Portuguese and in US dollars in English.",
  },
  {
    q: "What counts as an AI review?",
    a: "Each time the coach writes a review for one player of one match. Opening a review you already have is free; “Ask again” counts as a new one.",
  },
  {
    q: "When do daily limits reset?",
    a: "Every day at midnight (UTC). The coach screen shows exactly how long until the next reset.",
  },
] as const;

export function PricingFaq() {
  const { t } = useI18n();
  return (
    <div className="faq">
      {FAQ.map(({ q, a }) => (
        <details key={q}>
          <summary>{t(q)}</summary>
          <p>{t(a)}</p>
        </details>
      ))}
    </div>
  );
}
