"use client";
import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { BRAND, LogoMark } from "@/shared/brand";
import { useI18n } from "@/shared/i18n";
import { formatDate } from "@/shared/format";
import {
  ArrowRight,
  Dumbbell,
  Film,
  Radar,
  Refresh,
  Star,
  Target,
} from "@/shared/icons";
import { MapBadge } from "@/features/maps";
import { overallScore, type ClipRef } from "../model/coaching";
import type { ActiveReview } from "../hooks/useCoachSession";
import { DrillChecklist } from "./DrillChecklist";
import { InsightBoard } from "./InsightBoard";
import { KeyMomentReel } from "./KeyMomentReel";
import { PlanBoard } from "./PlanBoard";
import { ScoreRadar } from "./ScoreRadar";

/** The review report. Every section hides itself when its data is absent (older reviews). */
export function CoachReport({
  review,
  playerName,
  map,
  matchHref,
  roundsFor,
  onPlay,
  onRate,
  onRegenerate,
  regenerateNote,
  deepSlot,
  tail,
}: {
  review: ActiveReview;
  playerName: string;
  map: string | null;
  matchHref: string;
  roundsFor: (ids: string[]) => number[];
  onPlay: (clip: ClipRef, title: string) => void;
  onRate: (n: number) => void;
  onRegenerate: () => void;
  regenerateNote?: string | null;
  /** Deep sections, rendered after the key moments. */
  deepSlot?: ReactNode;
  /** Rendered after the plan (e.g. the Deep teaser under a Quick review). */
  tail?: ReactNode;
}) {
  const { t, locale } = useI18n();
  const c = review.coaching;
  const reviewMap = c.map ?? map;
  const overall = overallScore(c.scores);
  const ref = useRef<HTMLElement>(null);
  // A fresh review lands where the loader was: bring its verdict into view.
  useEffect(() => {
    if (!review.fresh) return;
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    ref.current?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  }, [review.fresh, review.id]);
  const caveats = [
    ...new Set([...c.caveats, ...c.insights.flatMap((i) => i.caveats)]),
  ];
  return (
    <article ref={ref} className="report" data-testid="coach-report">
      <header className="verdict">
        <div className="verdict-mark" aria-hidden>
          <LogoMark size={56} />
        </div>
        <div className="verdict-text">
          <span className="eyebrow">
            <span className={`tier-tag ${review.tier}`}>
              {review.tier === "deep" ? t("Deep review") : t("Quick review")}
            </span>
            {BRAND.coach} · {playerName}
            {reviewMap && (
              <>
                {" · "}
                <MapBadge map={reviewMap} size={18} />
              </>
            )}
          </span>
          <h2>{c.verdict ?? t("Your match, reviewed")}</h2>
          {c.summary && <p className="lead">{c.summary}</p>}
          {!review.fresh && review.createdAt && (
            <p className="muted small">
              {t("Saved review from {date}", {
                date: formatDate(review.createdAt, locale) ?? "",
              })}
            </p>
          )}
        </div>
        {overall !== null && (
          <div
            className="verdict-score"
            aria-label={t("Overall score {n} of 100", { n: overall })}
          >
            <b>{overall}</b>
            <small>{t("Overall")}</small>
          </div>
        )}
      </header>

      {c.scores.length >= 3 && (
        <section className="report-sec">
          <h3 className="sec-title">
            <Radar size={20} /> {t("Your scores vs the lobby")}
          </h3>
          <ScoreRadar scores={c.scores} />
        </section>
      )}

      {c.keyMoments.length > 0 && (
        <section className="report-sec">
          <h3 className="sec-title">
            <Film size={20} /> {t("Key moments")}
          </h3>
          <KeyMomentReel moments={c.keyMoments} onPlay={onPlay} />
        </section>
      )}

      {deepSlot}

      {c.insights.length > 0 ? (
        <section className="report-sec">
          <h3 className="sec-title">
            <Target size={20} /> {t("Priorities")}
          </h3>
          <InsightBoard
            insights={c.insights}
            map={reviewMap}
            roundsFor={roundsFor}
            onPlay={onPlay}
          />
        </section>
      ) : (
        <p className="empty compact">
          {t(
            "The coach found nothing it could back with evidence for this player.",
          )}
        </p>
      )}

      {c.drills.length > 0 && (
        <section className="report-sec">
          <h3 className="sec-title">
            <Dumbbell size={20} /> {t("Drills")}
          </h3>
          <DrillChecklist drills={c.drills} map={reviewMap} />
        </section>
      )}

      {c.plan.length > 0 && (
        <section className="report-sec game-plan">
          <h3 className="sec-title">
            <Target size={20} /> {t("Plan for your next match")}
          </h3>
          <PlanBoard plan={c.plan} map={reviewMap} />
        </section>
      )}

      {tail}

      <footer className="report-foot">
        <div className="rate-review">
          <span>{t("Was this review helpful?")}</span>
          <span className="stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={t("{n} stars", { n })}
                aria-pressed={review.rating !== null && n <= review.rating}
                className={
                  review.rating !== null && n <= review.rating ? "on" : ""
                }
                onClick={() => onRate(n)}
              >
                <Star size={20} />
              </button>
            ))}
          </span>
          {review.rating !== null && (
            <span className="muted small" role="status">
              {t("Saved to your progress.")}
            </span>
          )}
        </div>
        <div className="report-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onRegenerate}
          >
            <Refresh size={18} /> {t("Ask again")}
          </button>
          <Link className="btn btn-ghost" href={matchHref}>
            {t("Open match analysis")} <ArrowRight size={16} />
          </Link>
        </div>
        {regenerateNote && <p className="muted small">{regenerateNote}</p>}
      </footer>
      {caveats.length > 0 && (
        <details className="more">
          <summary>{t("Limits of this review")}</summary>
          <ul className="caveats">
            {caveats.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
