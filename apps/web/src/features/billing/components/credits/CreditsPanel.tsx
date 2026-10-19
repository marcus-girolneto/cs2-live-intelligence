"use client";
import Link from "next/link";
import { useI18n } from "@/shared/i18n";
import { formatDate } from "@/shared/format";
import { ArrowRight, Coin } from "@/shared/icons";
import { CountUp, Panel } from "@/shared/ui";
import { useCredits } from "../../hooks/useCredits";
import { useUpgrade } from "../../hooks/useUpgrade";
import { daysUntil, type CreditBucket } from "../../model/plans";

const BUCKETS: { key: CreditBucket; label: string; hint: string }[] = [
  { key: "plan", label: "Plan", hint: "Expire at renewal" },
  { key: "bonus", label: "Bonus", hint: "Welcome and gifts" },
  { key: "purchased", label: "Purchased", hint: "Never expire" },
];

/** Dashboard / billing panel: balance by bucket, plan-credit expiry and "Buy credits". */
export function CreditsPanel({ history = true }: { history?: boolean }) {
  const { t, locale } = useI18n();
  const { credits, cost, isAdmin } = useCredits();
  const { openCredits } = useUpgrade();
  if (!credits) return null;
  const total = credits.balance;
  const days = daysUntil(credits.planExpiresAt);
  return (
    <Panel
      className="credits-panel"
      icon={<Coin size={20} />}
      title={t("Credits")}
      sub={
        isAdmin
          ? t("Admins run reviews without spending credits.")
          : t("Quick review {q} · Deep review {d}", {
              q: t("{n} cr", { n: cost("quick") }),
              d: t("{n} cr", { n: cost("deep") }),
            })
      }
    >
      <div className="cp-balance">
        <span className="cp-coin" aria-hidden>
          <Coin size={30} />
        </span>
        <b className="tabular" aria-label={t("{n} credits", { n: total })}>
          <CountUp value={total} />
        </b>
        <span className="muted">{t("credits available")}</span>
      </div>
      <div
        className="cp-bar"
        role="img"
        aria-label={BUCKETS.map(
          (b) => `${t(b.label)}: ${credits.buckets[b.key]}`,
        ).join(", ")}
      >
        {BUCKETS.map((b) =>
          credits.buckets[b.key] > 0 ? (
            <i
              key={b.key}
              className={`cp-seg ${b.key}`}
              style={{ flexGrow: credits.buckets[b.key] }}
            />
          ) : null,
        )}
      </div>
      <ul className="cp-buckets">
        {BUCKETS.map((b) => (
          <li key={b.key}>
            <i className={`cp-dot ${b.key}`} aria-hidden />
            <span>
              <strong>{t(b.label)}</strong>
              <small>
                {b.key === "plan" && days !== null
                  ? t("Expiring in {n} days", { n: days })
                  : t(b.hint)}
              </small>
            </span>
            <b className="tabular">{credits.buckets[b.key]}</b>
          </li>
        ))}
      </ul>
      {credits.planExpiresAt && credits.buckets.plan > 0 && (
        <p className="muted small">
          {t("Plan credits renew on {date}.", {
            date: formatDate(credits.planExpiresAt, locale) ?? "—",
          })}
        </p>
      )}
      <div className="form-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => openCredits()}
        >
          <Coin size={16} /> {t("Buy credits")}
        </button>
        {history && (
          <Link className="btn btn-ghost btn-sm" href="/billing#credits">
            {t("Credit history")} <ArrowRight size={16} />
          </Link>
        )}
      </div>
    </Panel>
  );
}
