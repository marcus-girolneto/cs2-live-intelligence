"use client";
import { useI18n } from "@/shared/i18n";
import { formatDate, formatNumber, mapName } from "@/shared/format";
import { Check, ChevronRight } from "@/shared/icons";
import { MapTile } from "@/shared/ui";
import type { MatchCardModel } from "../model/session";

/** Step 1: visual match cards (map, date, score, your K-D/ADR, reviewed state). */
export function MatchPicker({
  cards,
  onPick,
}: {
  cards: MatchCardModel[];
  onPick: (matchId: string) => void;
}) {
  const { t, locale } = useI18n();
  return (
    <ul className="pick-grid stagger">
      {cards.map((c) => {
        const map = mapName(c.map);
        return (
          <li key={c.matchId}>
            <button
              type="button"
              className={`match-pick ${c.reviewed ? "reviewed" : ""}`}
              onClick={() => onPick(c.matchId)}
            >
              <span
                className={`mp-art map-${(c.map ?? "x").replace(/[^a-z0-9_]/g, "")}`}
                aria-hidden
              >
                <MapTile map={c.map} size={52} />
                {c.score && (
                  <span className="mp-score">
                    <b className="ct">{c.score.ct}</b>:
                    <b className="t">{c.score.t}</b>
                  </span>
                )}
              </span>
              <span className="mp-body">
                <strong>{map ?? (c.filename || t("Unnamed demo"))}</strong>
                <small>
                  {[map ? c.filename : null, formatDate(c.date, locale)]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
                <span className="mp-stats">
                  {c.kills !== null && c.deaths !== null && (
                    <span>
                      <b>
                        {formatNumber(c.kills, 0, locale)}–
                        {formatNumber(c.deaths, 0, locale)}
                      </b>
                      <small>{t("K–D")}</small>
                    </span>
                  )}
                  {c.adr !== null && (
                    <span>
                      <b>{formatNumber(c.adr, 1, locale)}</b>
                      <small>ADR</small>
                    </span>
                  )}
                  {c.rounds !== null && (
                    <span>
                      <b>{c.rounds}</b>
                      <small>{t("Rounds")}</small>
                    </span>
                  )}
                </span>
              </span>
              <span className="mp-state">
                {c.reviewed ? (
                  <span className="chip good">
                    <Check size={14} /> {t("Reviewed")}
                  </span>
                ) : (
                  <span className="chip accent">{t("New")}</span>
                )}
                <ChevronRight size={18} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
