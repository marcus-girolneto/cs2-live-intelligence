"use client";
import { useI18n } from "@/shared/i18n";
import { MapTile, CountUp } from "@/shared/ui";
import type { AnalysisVM } from "../hooks/useAnalysisView";
/** Map, score and round strip of the analysed match. */
export function MatchHero({ vm }: { vm: AnalysisVM }) {
  const { t } = useI18n();
  const { analysis, players, rounds, wins, map } = vm;
  return (
    <section className="match-hero">
      <div className="mh-left">
        <MapTile map={analysis.map} size={64} />
        <div>
          <span className="eyebrow">{t("Demo analysis")}</span>
          <h2>{map ?? t("Unknown map")}</h2>
          <p className="muted">
            {[
              rounds.length
                ? t("{n} rounds analyzed", { n: rounds.length })
                : null,
              players.length ? t("{n} players", { n: players.length }) : null,
            ]
              .filter(Boolean)
              .join(" · ") || t("No complete rounds in this demo")}
          </p>
        </div>
      </div>
      {rounds.length > 0 && (
        <div className="mh-score" aria-label={t("Rounds won by side")}>
          <span className="ct">
            <small>CT</small>
            <b>
              <CountUp value={wins.CT} />
            </b>
          </span>
          <span className="mh-vs">:</span>
          <span className="t">
            <small>T</small>
            <b>
              <CountUp value={wins.T} />
            </b>
          </span>
        </div>
      )}
      <div className="mh-rounds" aria-hidden>
        {rounds.map((r) => (
          <i key={r.round} className={r.winner?.toLowerCase() ?? ""} />
        ))}
      </div>
    </section>
  );
}
