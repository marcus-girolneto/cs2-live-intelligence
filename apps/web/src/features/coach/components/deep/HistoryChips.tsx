"use client";
import { useUpgrade, useUsage } from "@/features/billing";
import { useI18n } from "@/shared/i18n";
import { formatNumber } from "@/shared/format";
import { Lock, Trend } from "@/shared/icons";
import { trendOf, type HistoryChip } from "../../model/deep";
import { HISTORY_LABEL } from "../../model/deepText";

/** Pro: how each deep metric moved against your previous matches (locked chip otherwise). */
export function HistoryChips({ chips }: { chips: HistoryChip[] }) {
  const { t, locale } = useI18n();
  const { limits, isAdmin } = useUsage();
  const upgrade = useUpgrade();
  const allowed = isAdmin || !!limits?.historyCompare;
  if (!allowed)
    return (
      <div className="history-chips">
        <button
          type="button"
          className="chip hc-locked"
          onClick={() => upgrade.open({ feature: "history_compare", limit: 0 })}
        >
          <Lock size={14} /> {t("History compare")} · Pro
        </button>
      </div>
    );
  if (!chips.length) return null;
  return (
    <ul
      className="history-chips"
      aria-label={t("Compared with your previous matches")}
    >
      {chips.map((c) => {
        const trend = trendOf(c);
        const delta = c.current - c.baseline;
        const fmt = (v: number) =>
          `${formatNumber(v, Math.abs(v) < 10 && !Number.isInteger(v) ? 1 : 0, locale) ?? "–"}${c.unit}`;
        return (
          <li key={c.key} className={`chip hc ${trend}`}>
            <Trend size={14} className={delta < 0 ? "down" : ""} />
            <span>{t(HISTORY_LABEL[c.key] ?? c.label)}</span>
            <b className="tabular">{fmt(c.current)}</b>
            <small>{t("vs {v} before", { v: fmt(c.baseline) })}</small>
          </li>
        );
      })}
    </ul>
  );
}
