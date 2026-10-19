"use client";
import { PROGRESS_METRICS } from "@/features/maps";
import { finite, formatNumber } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Stat } from "@/shared/ui";
import type { Profile } from "../model/chart";
/** Recent form vs overall for every tracked metric. */
export function ProgressStats({ profile }: { profile: Profile }) {
  const { t, locale } = useI18n();
  return (
    <div className="stat-grid stagger">
      {PROGRESS_METRICS.map(({ key, label, unit, digits }) => {
        const m = profile.metrics[key];
        const recent = finite(m?.recent);
        const overall = finite(m?.overall);
        const delta =
          recent !== null && overall !== null ? recent - overall : null;
        return (
          <Stat
            key={key}
            label={t(label)}
            value={recent}
            digits={digits}
            {...(unit ? { suffix: unit } : {})}
            sub={
              <>
                {t("Last {n} matches", {
                  n: Math.min(3, m?.matches ?? 0),
                })}{" "}
                ·{" "}
                {t("overall {v}", {
                  v:
                    overall === null
                      ? "—"
                      : `${formatNumber(overall, digits, locale)}${unit ?? ""}`,
                })}
              </>
            }
            {...(delta !== null && Math.abs(delta) >= 0.01
              ? { tone: delta > 0 ? "good" : "bad" }
              : {})}
          />
        );
      })}
    </div>
  );
}
