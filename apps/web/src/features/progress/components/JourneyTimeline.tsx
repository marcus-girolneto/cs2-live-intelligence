"use client";
import { Fragment, useState } from "react";
import { useI18n } from "@/shared/i18n";
import type { JourneyNode } from "../model/journey";
import { AdherenceConnector } from "./AdherenceConnector";
import { TimelineNode } from "./TimelineNode";

/**
 * Matches in order with "Did you apply it?" between them. The connector before a match
 * checks the previous plan on that match, so it always sits between the two.
 */
export function JourneyTimeline({ nodes }: { nodes: JourneyNode[] }) {
  const { t } = useI18n();
  const [newestFirst, setNewestFirst] = useState(false);
  const list = newestFirst ? [...nodes].reverse() : nodes;
  return (
    <section className="journey" aria-labelledby="journey-title">
      <header className="journey-head">
        <h2 id="journey-title">{t("Match by match")}</h2>
        <div className="segmented" role="group" aria-label={t("Order")}>
          <button
            type="button"
            aria-pressed={!newestFirst}
            onClick={() => setNewestFirst(false)}
          >
            {t("Oldest first")}
          </button>
          <button
            type="button"
            aria-pressed={newestFirst}
            onClick={() => setNewestFirst(true)}
          >
            {t("Newest first")}
          </button>
        </div>
      </header>
      <ol className="timeline-list">
        {list.map((n, i) => (
          <Fragment key={n.analysisId}>
            {!newestFirst && i > 0 && n.adherence.length > 0 && (
              <li className="tl-gap">
                <AdherenceConnector items={n.adherence} />
              </li>
            )}
            <li>
              <TimelineNode node={n} />
            </li>
            {newestFirst && i < list.length - 1 && n.adherence.length > 0 && (
              <li className="tl-gap">
                <AdherenceConnector items={n.adherence} />
              </li>
            )}
          </Fragment>
        ))}
      </ol>
    </section>
  );
}
