"use client";
import type { Review } from "@/features/maps";
import Link from "next/link";
import { parsePlan } from "@/features/coach";
import { PlanList } from "@/features/maps";
import { formatDate } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { ArrowRight, Brain, Star } from "@/shared/icons";
import { Panel } from "@/shared/ui";
/** Stored AI reviews with a 1–5 star rating. */
export function ReviewHistory({
  reviews,
  rate,
}: {
  reviews: Review[];
  rate: (id: string, rating: number) => Promise<void>;
}) {
  const { t, locale } = useI18n();
  return (
    <Panel icon={<Brain size={20} />} title={t("Coach review history")}>
      {reviews.length === 0 ? (
        <p className="muted small">
          {t("No AI reviews yet. Open the AI Coach and pick a match.")}
        </p>
      ) : (
        <ul className="review-list">
          {reviews.map((r) => (
            <li key={r.id}>
              <header>
                <span className="muted small">
                  {[formatDate(r.createdAt, locale), r.filename]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span
                  className="stars"
                  aria-label={t("Was this review helpful?")}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-label={t("{n} stars", { n })}
                      className={r.rating !== null && n <= r.rating ? "on" : ""}
                      onClick={() => void rate(r.id, n)}
                    >
                      <Star size={16} />
                    </button>
                  ))}
                </span>
              </header>
              {r.coaching.summary && <p>{r.coaching.summary}</p>}
              <PlanList items={parsePlan(r.coaching)} compact />
              <Link
                className="btn-link"
                href={`/coach?match=${encodeURIComponent(r.analysisId)}${r.steamId ? `&player=${encodeURIComponent(r.steamId)}` : ""}`}
              >
                {t("Open the full review")} <ArrowRight size={14} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
