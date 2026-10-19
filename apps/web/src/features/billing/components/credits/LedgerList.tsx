"use client";
import { useI18n } from "@/shared/i18n";
import { formatDate } from "@/shared/format";
import { Coin, ListIcon, Refresh } from "@/shared/icons";
import { Callout, EmptyState, Skeleton } from "@/shared/ui";
import { reasonLabel, type LedgerEntry } from "../../model/plans";

const BUCKET_LABEL: Record<string, string> = {
  plan: "Plan",
  bonus: "Bonus",
  purchased: "Purchased",
};

/** Credit movements (newest first): what changed, why, which bucket, when. */
export function LedgerList({
  entries,
  error,
  onRetry,
}: {
  entries: LedgerEntry[] | null;
  error?: string;
  onRetry?: () => void;
}) {
  const { t, locale } = useI18n();
  if (entries === null) return <Skeleton lines={4} />;
  if (error)
    return (
      <Callout tone="error" role="alert">
        <p>{t(error)}</p>
        {onRetry && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onRetry}
          >
            <Refresh size={16} /> {t("Try again")}
          </button>
        )}
      </Callout>
    );
  if (!entries.length)
    return (
      <EmptyState
        compact
        icon={<ListIcon size={26} />}
        title={t("No credit movements yet")}
      >
        <p>{t("Reviews, purchases and monthly grants show up here.")}</p>
      </EmptyState>
    );
  return (
    <ol className="ledger">
      {entries.map((e) => (
        <li key={e.id} className={e.delta >= 0 ? "in" : "out"}>
          <span className="lg-icon" aria-hidden>
            <Coin size={16} />
          </span>
          <span className="lg-text">
            <strong>{t(reasonLabel(e.reason))}</strong>
            <small>
              {[
                formatDate(e.createdAt, locale),
                e.bucket ? t(BUCKET_LABEL[e.bucket]!) : null,
                e.note,
              ]
                .filter(Boolean)
                .join(" · ")}
            </small>
          </span>
          <b className="lg-delta tabular">
            {e.delta > 0
              ? `+${e.delta}`
              : e.delta === 0
                ? "0"
                : `−${Math.abs(e.delta)}`}
          </b>
        </li>
      ))}
    </ol>
  );
}
