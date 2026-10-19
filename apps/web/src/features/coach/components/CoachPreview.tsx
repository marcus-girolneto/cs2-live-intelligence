"use client";
import Link from "next/link";
import { BRAND, LogoMark } from "@/shared/brand";
import { useI18n } from "@/shared/i18n";
import { ArrowRight, Brain } from "@/shared/icons";
import { PlanList } from "@/features/maps";
import type { CoachReview } from "../model/coaching";

/** Compact AI Coach tab inside the match analysis: the saved verdict + a link to /coach. */
export function CoachPreview({
  href,
  name,
  review,
}: {
  href: string;
  name: string;
  review: CoachReview | null;
}) {
  const { t } = useI18n();
  return (
    <section className="coach-preview">
      <div className="cp-head">
        <LogoMark size={52} />
        <div>
          <span className="eyebrow">{BRAND.coach}</span>
          <h3>
            {review
              ? (review.verdict ?? t("Review for {name}", { name }))
              : t("Get {name}'s full review", { name })}
          </h3>
        </div>
      </div>
      {review?.summary ? (
        <p className="lead">{review.summary}</p>
      ) : (
        <p className="muted">
          {t(
            "Scores against the lobby, key moments as 2D replays, drills and a plan for your next match.",
          )}
        </p>
      )}
      {review && review.plan.length > 0 && (
        <PlanList items={review.plan.slice(0, 3)} compact />
      )}
      <Link className="btn btn-primary" href={href} data-testid="open-coach">
        <Brain size={18} />{" "}
        {review ? t("Open the full review") : t("Open in the coach")}
        <ArrowRight size={16} />
      </Link>
    </section>
  );
}
