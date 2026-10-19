"use client";
import Link from "next/link";
import { MapBadge } from "@/features/maps";
import { formatDate, formatNumber } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { ArrowDown, ArrowRight, ArrowUp, Brain } from "@/shared/icons";
import { LOWER_IS_BETTER, type JourneyNode } from "../model/journey";
import { METRIC_INFO, NODE_METRICS } from "../model/metricInfo";

/** One match on the timeline: date, map, score, key numbers and the coach's plan. */
export function TimelineNode({ node }: { node: JourneyNode }) {
  const { t, locale } = useI18n();
  const r = node.result;
  const outcome = r ? (r.win === null ? "draw" : r.win ? "win" : "loss") : "";
  return (
    <article className={`tl-node ${outcome}`}>
      <span className="tl-dot" aria-hidden />
      <header className="tl-head">
        <MapBadge map={node.map} size={30} />
        <span className="tl-date">
          {formatDate(node.playedAt, locale) ?? t("Unknown date")}
        </span>
        {r && (
          <span className={`tl-score ${outcome}`}>
            {r.win === null ? t("Draw") : r.win ? t("Win") : t("Loss")}{" "}
            <b>
              {r.won}–{r.lost}
            </b>
          </span>
        )}
      </header>
      <dl className="tl-metrics">
        {NODE_METRICS.map((k) => {
          const v = node.metrics[k];
          if (v === undefined) return null;
          const info = METRIC_INFO[k];
          const d = node.delta[k];
          const good =
            d === undefined || Math.abs(d) < 1e-9
              ? ""
              : (LOWER_IS_BETTER.has(k) ? -d : d) > 0
                ? "up"
                : "down";
          return (
            <div key={k}>
              <dt>{t(info.label)}</dt>
              <dd>
                {formatNumber(v, info.digits, locale)}
                {info.unit}
                {good && d !== undefined && (
                  <span
                    className={`tl-delta ${good}`}
                    aria-label={t(
                      good === "up"
                        ? "better than the previous match"
                        : "worse than the previous match",
                    )}
                  >
                    {d > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                    {formatNumber(Math.abs(d), info.digits, locale)}
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      {node.review && (
        <div className="tl-review">
          <p className="tl-verdict">
            <Brain size={18} />
            <span>
              {node.review.verdict ?? t("The coach reviewed this match.")}
            </span>
          </p>
          {node.review.planItems.length > 0 && (
            <>
              <p className="tl-plan-title">{t("Plan for the next match")}</p>
              <ol className="tl-plan">
                {node.review.planItems.map((p) => (
                  <li key={p.id}>{p.text}</li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
      <footer className="tl-links">
        <Link
          className="btn-link"
          href={`/history?match=${encodeURIComponent(node.analysisId)}`}
        >
          {t("Open analysis")} <ArrowRight size={14} />
        </Link>
        {node.review && (
          <Link
            className="btn-link"
            href={`/coach?match=${encodeURIComponent(node.analysisId)}`}
          >
            {t("Open the full review")} <ArrowRight size={14} />
          </Link>
        )}
      </footer>
    </article>
  );
}
