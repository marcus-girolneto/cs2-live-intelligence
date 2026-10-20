"use client";
import Link from "next/link";
import { PROGRESS_METRICS, type Progress } from "@/features/maps";
import { finite, formatNumber } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { ArrowRight, Trend } from "@/shared/icons";
import { Panel, Skeleton } from "@/shared/ui";
/** Recent form vs the player's average for the main metrics. */
export function FormPanel({
  progress,
  progressFailed,
}: {
  progress: Progress | null;
  progressFailed: boolean;
}) {
  const { t, locale } = useI18n();
  const metrics = progress?.profile?.metrics;
  return (
    <Panel
      icon={<Trend size={20} />}
      title={t("Your form")}
      sub={
        progress?.profile
          ? t("Last {n} matches vs your average", {
              n: Math.min(3, progress.profile.matches),
            })
          : undefined
      }
      actions={
        <Link className="btn btn-ghost btn-sm" href="/progress">
          {t("Progress")} <ArrowRight size={16} />
        </Link>
      }
    >
      {!progress && !progressFailed ? (
        <Skeleton lines={4} />
      ) : metrics ? (
        <ul className="form-list">
          {PROGRESS_METRICS.slice(0, 4).map(({ key, label, unit, digits }) => {
            const m = metrics[key];
            const recent = finite(m?.recent);
            const overall = finite(m?.overall);
            const delta =
              recent !== null && overall !== null ? recent - overall : null;
            const dir =
              delta === null || Math.abs(delta) < 0.005
                ? "flat"
                : delta > 0
                  ? "up"
                  : "down";
            return (
              <li key={key} className={`form-${dir}`}>
                <span className="form-label">{t(label)}</span>
                <b>
                  {recent === null
                    ? "–"
                    : `${formatNumber(recent, digits, locale)}${unit ?? ""}`}
                </b>
                <span className="form-delta">
                  {delta === null
                    ? t("No data")
                    : dir === "flat"
                      ? t("steady")
                      : `${delta > 0 ? "▲" : "▼"} ${formatNumber(Math.abs(delta), digits, locale)}${unit ?? ""}`}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted small">
          {progress?.playerSteamId
            ? t(
                "Upload a demo of a match you played to start tracking your form.",
              )
            : t("Sign in with Steam, or open a demo and press “This is me”.")}
        </p>
      )}
    </Panel>
  );
}
