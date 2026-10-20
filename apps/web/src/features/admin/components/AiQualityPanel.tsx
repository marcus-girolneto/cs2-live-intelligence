"use client";
import { useEffect, useState } from "react";
import { formatDate, formatNumber } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Star } from "@/shared/icons";
import { Panel } from "@/shared/ui";
import { useAdminApi } from "../api/context";
import type { EvalSummary, RatingRow } from "../model/quality";
import { PURPOSE_LABEL } from "../model/types";

/** AI quality: player ratings per prompt variant and the latest automated eval. */
export function AiQualityPanel() {
  const { t, locale } = useI18n();
  const api = useAdminApi();
  const [ratings, setRatings] = useState<RatingRow[] | null>(null);
  const [evalRun, setEval] = useState<EvalSummary | null | undefined>(
    undefined,
  );
  useEffect(() => {
    api
      .aiRatings()
      .then(setRatings)
      .catch(() => setRatings([]));
    api
      .latestEval()
      .then(setEval)
      .catch(() => setEval(null));
  }, [api]);
  if (!ratings?.length && !evalRun) return null;
  const pct = (v: number | null) =>
    v === null ? "–" : `${formatNumber(v * 100, 0, locale)}%`;
  const tiles: [string, string][] = evalRun
    ? [
        [t("Runs"), `${evalRun.runs - evalRun.failed}/${evalRun.runs}`],
        [t("Grounded claims"), pct(evalRun.groundingRate)],
        [t("Rejected by the verifier"), pct(evalRun.verifierRejectionRate)],
        [t("Right language"), pct(evalRun.languagePurity)],
        [
          t("Average latency"),
          evalRun.avgLatencyMs === null
            ? "–"
            : `${formatNumber(evalRun.avgLatencyMs / 1000, 1, locale)} s`,
        ],
        [
          t("Cost"),
          evalRun.costUsd === null
            ? "–"
            : `$${formatNumber(evalRun.costUsd, 2, locale)}`,
        ],
      ]
    : [];
  return (
    <Panel
      className="adm-span"
      icon={<Star size={20} />}
      title={t("AI quality")}
      sub={t(
        "How players rate each prompt version, and the latest automated check of grounding, language and cost.",
      )}
    >
      {evalRun && (
        <>
          <h4 className="adm-sub">
            {t("Latest eval")}
            {evalRun.createdAt &&
              ` · ${formatDate(evalRun.createdAt, locale) ?? ""}`}
          </h4>
          <div className="adm-tiles">
            {tiles.map(([label, value]) => (
              <div key={label} className="adm-tile">
                <small>{label}</small>
                <b>{value}</b>
              </div>
            ))}
          </div>
        </>
      )}
      {ratings && ratings.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">{t("Ratings")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("Purpose")}</th>
                <th scope="col">{t("Variant")}</th>
                <th scope="col">{t("Prompt")}</th>
                <th scope="col" className="r">
                  {t("Reviews")}
                </th>
                <th scope="col" className="r">
                  {t("Rated")}
                </th>
                <th scope="col" className="r">
                  {t("Average")}
                </th>
              </tr>
            </thead>
            <tbody>
              {ratings.map((r) => (
                <tr key={`${r.purpose}-${r.variant}-${r.promptVersion}`}>
                  <td>{t(PURPOSE_LABEL[r.purpose] ?? r.purpose)}</td>
                  <td>{r.variant.toUpperCase()}</td>
                  <td>
                    <code>{r.promptVersion}</code>
                  </td>
                  <td className="r tabular">{r.reviews}</td>
                  <td className="r tabular">{r.rated}</td>
                  <td className="r tabular">
                    {r.avgRating === null
                      ? "–"
                      : `${formatNumber(r.avgRating, 2, locale)} ★`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
