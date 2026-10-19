"use client";
import { useI18n } from "@/shared/i18n";
import type { Journey } from "../model/journey";
import { LearnedPanel } from "./LearnedPanel";
import { LiveCalls } from "./LiveCalls";
import { ReviewHistory } from "./ReviewHistory";

/** Collapsed archive: what the coach learned, every review (with ratings) and live calls. */
export function ProgressHistory({
  data,
  rate,
}: {
  data: Journey;
  rate: (id: string, rating: number) => Promise<void>;
}) {
  const { t } = useI18n();
  if (!data.profile && !data.reviews.length && !data.liveCalls.length)
    return null;
  return (
    <details className="progress-history">
      <summary>
        {t("History")}{" "}
        <span className="muted small">
          {t("Reviews, ratings, live calls and what the coach learned")}
        </span>
      </summary>
      {data.profile && <LearnedPanel profile={data.profile} />}
      <div className="grid-2">
        <ReviewHistory reviews={data.reviews} rate={rate} />
        <LiveCalls calls={data.liveCalls} />
      </div>
    </details>
  );
}
