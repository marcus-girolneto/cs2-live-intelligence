"use client";
import { formatNumber } from "@/shared/format";
import { Term } from "@/shared/glossary";
import { useI18n } from "@/shared/i18n";
import { ArrowDown, ArrowUp } from "@/shared/icons";
import type { JourneyNode } from "../model/journey";
import { adherenceCounts, summaryLines, trendOf } from "../model/summary";
import { HEADLINE, METRIC_INFO } from "../model/metricInfo";
import { Sparkline } from "./Sparkline";

/** Plain-language summary, four trend tiles and the plan-adherence ring. */
export function JourneySummary({
  nodes,
  adherenceRate,
}: {
  nodes: JourneyNode[];
  adherenceRate: number | null;
}) {
  const { t, locale } = useI18n();
  const lines = summaryLines(nodes);
  const counts = adherenceCounts(nodes);
  return (
    <section className="journey-summary" aria-label={t("Summary")}>
      {lines.length > 0 && (
        <p className="js-lines">
          {lines
            .map((l) =>
              t(
                l.text,
                Object.fromEntries(
                  Object.entries(l.params).map(([k, v]) => [
                    k,
                    formatNumber(
                      v,
                      k === "n" || k === "applied" || k === "checked"
                        ? 0
                        : l.digits,
                      locale,
                    ) ?? "",
                  ]),
                ),
              ),
            )
            .join(" ")}
        </p>
      )}
      <div className="js-tiles">
        {HEADLINE.map((key) => {
          const tr = trendOf(nodes, key);
          if (!tr) return null;
          const info = METRIC_INFO[key];
          const fmt = (v: number) =>
            `${formatNumber(v, info.digits, locale) ?? "—"}${info.unit}`;
          return (
            <div key={key} className={`js-tile ${tr.direction}`}>
              <span className="js-label">
                {info.term ? (
                  <Term id={info.term}>{t(info.label)}</Term>
                ) : (
                  t(info.label)
                )}
              </span>
              <strong className="js-value">{fmt(tr.last)}</strong>
              <Sparkline values={tr.values} />
              <span className="js-change">
                {tr.direction === "flat" ? (
                  tr.values.length < 2 ? (
                    t("One match so far")
                  ) : (
                    t("No change")
                  )
                ) : (
                  <>
                    {tr.change > 0 ? (
                      <ArrowUp size={14} />
                    ) : (
                      <ArrowDown size={14} />
                    )}
                    {t("from {from}", { from: fmt(tr.first) })}
                  </>
                )}
              </span>
            </div>
          );
        })}
        <div className="js-tile js-ring-tile">
          <span className="js-label">{t("Plan adherence")}</span>
          <AdherenceRing value={adherenceRate} />
          <span className="js-change">
            {counts.checked > 0
              ? t("{applied} of {checked} tips applied", {
                  applied: counts.applied,
                  checked: counts.checked,
                })
              : t("Checked on your next match")}
          </span>
        </div>
      </div>
    </section>
  );
}

function AdherenceRing({ value }: { value: number | null }) {
  const { locale } = useI18n();
  const r = 26;
  const c = 2 * Math.PI * r;
  const v = value ?? 0;
  return (
    <span
      className="adh-ring"
      role="img"
      aria-label={value === null ? "—" : `${Math.round(v)}%`}
    >
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden>
        <circle cx="32" cy="32" r={r} className="adh-track" />
        {value !== null && (
          <circle
            cx="32"
            cy="32"
            r={r}
            className="adh-fill"
            strokeDasharray={`${(v / 100) * c} ${c}`}
            transform="rotate(-90 32 32)"
          />
        )}
      </svg>
      <b>{value === null ? "—" : `${formatNumber(v, 0, locale)}%`}</b>
    </span>
  );
}
