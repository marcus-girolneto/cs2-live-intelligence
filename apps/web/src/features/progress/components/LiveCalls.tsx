"use client";
import type { LiveCallRecord } from "@/features/maps";
import { formatDate } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Monitor } from "@/shared/icons";
import { Panel } from "@/shared/ui";
/** AI IGL calls made during live sessions. */
export function LiveCalls({ calls }: { calls: LiveCallRecord[] }) {
  const { t, locale } = useI18n();
  return (
    <Panel icon={<Monitor size={20} />} title={t("Live calls")}>
      {calls.length === 0 ? (
        <p className="muted small">
          {t("No live calls yet. Use the second screen during a match.")}
        </p>
      ) : (
        <ul className="review-list">
          {calls.map((c) => (
            <li key={c.id}>
              <span className="muted small">
                {[
                  formatDate(c.createdAt, locale),
                  c.round !== null ? t("Round {n}", { n: c.round }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {c.call.call && <strong>{c.call.call}</strong>}
              {c.call.why && <p className="muted">{c.call.why}</p>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
