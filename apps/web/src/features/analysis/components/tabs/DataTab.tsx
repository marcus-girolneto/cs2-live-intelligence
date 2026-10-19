"use client";
import { finite, formatNumber } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { TabPanel } from "@/shared/ui";
import type { AnalysisVM } from "../../hooks/useAnalysisView";
import { METRICS } from "../../model/metrics";
import { metricOf } from "../../model/players";
/** Data & sources tab: every metric with its formula and source events. */
export function DataTab({ vm }: { vm: AnalysisVM }) {
  const { t, locale } = useI18n();
  const num = (v: unknown, d = 0) => formatNumber(v, d, locale);
  const { analysis, player, idBase } = vm;
  return (
    <TabPanel idBase={idBase} id="data">
      <p className="muted">
        {t(
          "Every number on this page comes from these formulas. Incomplete metrics are not shown as numbers anywhere.",
        )}
      </p>
      <div className="table-wrap">
        <table className="table formula-table">
          <thead>
            <tr>
              <th>{t("Metric")}</th>
              <th className="r">{t("Value")}</th>
              <th className="r">{t("Calculation")}</th>
              <th>{t("How it is calculated")}</th>
              <th className="r">{t("Source events")}</th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map(({ key, label, unit }) => {
              const m = metricOf(player, key);
              if (!m) return null;
              const v = m.complete ? finite(m.value) : null;
              const eventCount = analysis.evidence
                .filter((e) => m.evidenceIds.includes(e.id))
                .reduce((n, e) => n + e.eventIds.length, 0);
              return (
                <tr key={key}>
                  <td className="metric-name">{t(label)}</td>
                  <td className="r">
                    {m.complete
                      ? v === null
                        ? "—"
                        : unit === "%"
                          ? `${num(v)}%`
                          : unit === "adr" || unit === "dec"
                            ? num(v, 1)
                            : unit === "s"
                              ? `${num(v, 1)}s`
                              : unit === "m"
                                ? `${num(v)} m`
                                : num(v)
                      : t("Incomplete")}
                  </td>
                  <td className="r">
                    {num(m.numerator) ?? "—"} / {num(m.denominator) ?? "—"}
                  </td>
                  <td className="muted">{m.formula}</td>
                  <td className="r">{eventCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Steam ID <code>{player.steamId}</code> · Parser{" "}
        {analysis.provenance?.parserVersion ?? "—"} · {t("Metrics")}{" "}
        {analysis.provenance?.metricVersion ?? "—"}
      </p>
      {analysis.caveats.map((c, i) => (
        <p className="callout tone-warn" key={i}>
          {c}
        </p>
      ))}
    </TabPanel>
  );
}
