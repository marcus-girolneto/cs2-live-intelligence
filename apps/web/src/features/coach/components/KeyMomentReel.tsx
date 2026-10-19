"use client";
import { useI18n } from "@/shared/i18n";
import { Play, Skull, Trophy } from "@/shared/icons";
import type { ClipRef, KeyMoment } from "../model/coaching";

const clock = (s: number | null) =>
  s === null
    ? null
    : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Horizontal reel of key-moment cards; a card with a clip opens the clip player. */
export function KeyMomentReel({
  moments,
  onPlay,
}: {
  moments: KeyMoment[];
  onPlay: (clip: ClipRef, title: string) => void;
}) {
  const { t } = useI18n();
  if (!moments.length) return null;
  return (
    <div className="reel" role="list">
      {moments.map((m, i) => {
        const when = [
          m.round !== null ? t("Round {n}", { n: m.round }) : null,
          clock(m.time),
        ]
          .filter(Boolean)
          .join(" · ");
        const body = (
          <>
            <span className="reel-thumb" aria-hidden>
              <span className="reel-grid" />
              <span className={`reel-kind ${m.kind}`}>
                {m.kind === "highlight" ? (
                  <Trophy size={16} />
                ) : (
                  <Skull size={16} />
                )}
              </span>
              {m.clip && (
                <span className="reel-play">
                  <Play size={22} />
                </span>
              )}
              {when && <span className="reel-when">{when}</span>}
            </span>
            <span className="reel-text">
              <span className={`reel-tag ${m.kind}`}>
                {m.kind === "highlight" ? t("Highlight") : t("Mistake")}
                {m.scope === "map" && <em> · {t("Map")}</em>}
              </span>
              <strong>{m.title}</strong>
              {m.whatHappened && (
                <span className="reel-what">{m.whatHappened}</span>
              )}
              {m.whatToDoInstead && (
                <span className="reel-fix">
                  <b>
                    {m.kind === "highlight" ? t("Keep doing") : t("Instead")}
                  </b>{" "}
                  {m.whatToDoInstead}
                </span>
              )}
            </span>
          </>
        );
        return (
          <div
            role="listitem"
            key={`${m.eventId ?? i}-${i}`}
            className="reel-item"
          >
            {m.clip ? (
              <button
                type="button"
                className={`reel-card ${m.kind}`}
                onClick={() => onPlay(m.clip!, m.title)}
                aria-label={`${t("Watch clip")}: ${m.title}`}
              >
                {body}
              </button>
            ) : (
              <div className={`reel-card ${m.kind}`}>{body}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
