"use client";
import { useI18n } from "@/shared/i18n";
import { Check, Close } from "@/shared/icons";
import type { PlanLimits } from "../model/plans";

/** Human list of what a plan includes (✓ / ✕), shared by pricing cards and the upgrade sheet. */
export function PlanFeatures({
  limits,
  compact = false,
}: {
  limits: PlanLimits;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const n = (v: number | null) => (v === null ? "∞" : v);
  const rows: [boolean, string][] = [
    [
      true,
      limits.aiReviewsPerDay === 1
        ? t("1 AI Coach review per day")
        : t("{n} AI Coach reviews per day", { n: n(limits.aiReviewsPerDay) }),
    ],
    [
      (limits.liveAiMatchesPerDay ?? 1) > 0,
      (limits.liveAiMatchesPerDay ?? 1) > 0
        ? limits.liveAiMatchesPerDay === 1
          ? t("Live AI IGL in 1 match per day")
          : t("Live AI IGL in {n} matches per day", {
              n: n(limits.liveAiMatchesPerDay),
            })
        : t("Live AI IGL (rule-based tips only)"),
    ],
    [true, t("{n} demo uploads per day", { n: n(limits.uploadsPerDay) })],
    [
      true,
      limits.retentionDays === null
        ? t("Unlimited match history")
        : limits.retentionDays >= 365
          ? t("1-year match history")
          : t("{n}-day match history", { n: limits.retentionDays }),
    ],
    [true, t("Watch 2D clips of key moments")],
    [limits.clipExport, t("Export clips as video")],
    [limits.perMapLearning, t("Per-map deep learning")],
  ];
  return (
    <ul className={`plan-features ${compact ? "compact" : ""}`}>
      {rows
        .filter(([on]) => !compact || on)
        .map(([on, text]) => (
          <li key={text} className={on ? "on" : "off"}>
            {on ? <Check size={16} /> : <Close size={16} />}
            <span>{text}</span>
          </li>
        ))}
    </ul>
  );
}
