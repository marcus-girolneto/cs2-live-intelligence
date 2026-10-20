"use client";
import { formatNumber } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { CountUp } from "@/shared/ui";
import type { Insight } from "../model/insight/index";
export function AimSummary({
  insight,
  accuracyRef,
  headShare,
  headRef,
  big,
}: {
  insight: Insight;
  accuracyRef: number | null;
  headShare: number | null;
  headRef: number | null;
  big?: boolean;
}) {
  const { t, locale } = useI18n();
  const num = (v: unknown, d = 0) => formatNumber(v, d, locale);
  const acc = insight.accuracy;
  const R = 34;
  const C = 2 * Math.PI * R;
  return (
    <div className={`aim-summary ${big ? "big" : ""}`}>
      <div className="acc-ring">
        <svg viewBox="0 0 80 80" aria-hidden>
          <circle cx="40" cy="40" r={R} className="ar-bg" />
          {acc !== null && (
            <circle
              cx="40"
              cy="40"
              r={R}
              className="ar-fg"
              strokeDasharray={`${(Math.min(100, acc) / 100) * C} ${C}`}
            />
          )}
          {accuracyRef !== null && (
            <line
              x1="40"
              y1="2"
              x2="40"
              y2="10"
              className="ar-ref"
              transform={`rotate(${(Math.min(100, accuracyRef) / 100) * 360} 40 40)`}
            />
          )}
        </svg>
        <div className="ar-text">
          <b>{acc === null ? "–" : <CountUp value={acc} suffix="%" />}</b>
          <small>{t("Accuracy")}</small>
        </div>
      </div>
      <dl className="aim-facts">
        <div>
          <dt>{t("Shots hit")}</dt>
          <dd>
            {insight.hits !== null && insight.shots !== null
              ? `${num(insight.hits)} / ${num(insight.shots)}`
              : "–"}
          </dd>
        </div>
        <div>
          <dt>{t("Match avg. accuracy")}</dt>
          <dd>{accuracyRef === null ? "–" : `${num(accuracyRef)}%`}</dd>
        </div>
        <div>
          <dt>{t("Hits to the head")}</dt>
          <dd
            className={
              headShare !== null && headRef !== null
                ? headShare >= headRef
                  ? "good"
                  : "bad"
                : undefined
            }
          >
            {headShare === null ? "–" : `${num(headShare)}%`}
          </dd>
        </div>
        {insight.avgKillDistance !== null && (
          <div>
            <dt>{t("Avg. kill distance")}</dt>
            <dd>{t("{m} m", { m: num(insight.avgKillDistance)! })}</dd>
          </div>
        )}
      </dl>
      {acc !== null && accuracyRef !== null && (
        <p className={`verdict ${acc >= accuracyRef ? "fast" : "slow"}`}>
          {acc >= accuracyRef
            ? t(
                "You hit {a}% of your shots — better than the match average of {b}%.",
                {
                  a: num(acc)!,
                  b: num(accuracyRef)!,
                },
              )
            : t(
                "You hit {a}% of your shots — below the match average of {b}%. Fewer sprays, more first bullets.",
                {
                  a: num(acc)!,
                  b: num(accuracyRef)!,
                },
              )}
        </p>
      )}
    </div>
  );
}
