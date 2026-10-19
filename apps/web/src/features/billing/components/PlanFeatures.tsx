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
  // Same rows in the same order on every plan, so cards line up side by side.
  const live = limits.liveAiMatchesPerDay;
  const rows: [boolean, string][] = [
    limits.monthlyCredits
      ? [true, t("{n} credits every month", { n: limits.monthlyCredits })]
      : [true, t("1 welcome credit to start")],
    [true, t("Deep review: {n} credits", { n: limits.deepCost ?? 3 })],
    [
      live === null || live > 0,
      live === null
        ? t("Live AI IGL: unlimited")
        : live > 1
          ? t("Live AI IGL: {n} matches/day", { n: live })
          : live === 1
            ? t("Live AI IGL: 1 match/day")
            : t("Live tips only (no AI)"),
    ],
    [true, t("{n} uploads per day", { n: n(limits.uploadsPerDay) })],
    [
      true,
      limits.retentionDays === null
        ? t("Unlimited match history")
        : limits.retentionDays >= 365
          ? t("1-year match history")
          : t("{n}-day match history", { n: limits.retentionDays }),
    ],
    [true, t("2D clips of key moments")],
    [limits.clipExport, t("Export clips as video")],
    [limits.perMapLearning, t("Per-map learning")],
    [limits.monthlyReport, t("Monthly report")],
    [limits.personalCoach, t("Personal Coach")],
    [limits.matchReel, t("Match reel video")],
    [limits.historyCompare, t("History compare")],
    [limits.priorityQueue, t("Priority processing")],
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
