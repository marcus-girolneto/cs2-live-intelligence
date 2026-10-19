"use client";
import Link from "next/link";
import { MapBadge } from "@/features/maps";
import { formatDate, formatNumber, mapName } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { ArrowRight, Skull, Trophy } from "@/shared/icons";
import type { MatchCard } from "../model/report";

/** Best / worst match of the month. */
export function MatchSpotlight({
  kind,
  m,
}: {
  kind: "best" | "worst";
  m: MatchCard;
}) {
  const { t, locale } = useI18n();
  const id = m.matchId ?? m.analysisId;
  const stat = (v: number | null, d = 0) => formatNumber(v, d, locale) ?? "—";
  return (
    <article className={`spotlight ${kind}`}>
      <header>
        <span className="sp-kind">
          {kind === "best" ? <Trophy size={18} /> : <Skull size={18} />}
          {kind === "best" ? t("Best match") : t("Toughest match")}
        </span>
        {m.score !== null && (
          <b className="sp-score tabular">{stat(m.score)}</b>
        )}
      </header>
      <div className="sp-map">
        <MapBadge map={m.map} size={40} label={false} />
        <span>
          <strong>{mapName(m.map) ?? t("Match")}</strong>
          {m.date && (
            <small className="muted">{formatDate(m.date, locale)}</small>
          )}
        </span>
      </div>
      {m.headline && <p>{m.headline}</p>}
      <dl className="sp-stats">
        <div>
          <dt>K–D</dt>
          <dd className="tabular">
            {stat(m.kills)}–{stat(m.deaths)}
          </dd>
        </div>
        <div>
          <dt>ADR</dt>
          <dd className="tabular">{stat(m.adr, 1)}</dd>
        </div>
      </dl>
      {id && (
        <Link
          className="btn btn-ghost btn-sm"
          href={`/history?match=${encodeURIComponent(id)}`}
        >
          {t("Open match analysis")} <ArrowRight size={16} />
        </Link>
      )}
    </article>
  );
}
