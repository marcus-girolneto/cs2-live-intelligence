"use client";
import { useI18n } from "@/shared/i18n";
import { Timer } from "@/shared/icons";
import { dayLabel, resourceTitle, skillLabel, stepLabel } from "../model/copy";
import type { PracticeDay, Resource } from "../model/types";

/** Seven days: five pro-team sessions (review, warmup, habit, focus, debrief) and two rest days. */
export function PracticeWeek({
  week,
  resources,
}: {
  week: PracticeDay[];
  resources: Resource[];
}) {
  const { t } = useI18n();
  if (!week.length) return null;
  const title = (id: string | null) => {
    const r = id ? resources.find((x) => x.id === id) : undefined;
    return r ? resourceTitle(r, t) : null;
  };
  return (
    <ol className="tr-week" data-testid="practice-week">
      {week.map((d) => (
        <li key={d.day} className={`tr-day${d.rest ? " rest" : ""}`}>
          <h5>
            {dayLabel(d.day, t)}
            {d.focus && (
              <span className="tr-skill">{skillLabel(d.focus, t)}</span>
            )}
          </h5>
          {d.rest ? (
            <p className="muted small">
              {t("Rest day: no practice, sleep well.")}
            </p>
          ) : (
            <ul>
              {d.steps.map((s) => (
                <li key={s.step}>
                  <span className="tr-step-name">{stepLabel(s.step, t)}</span>
                  <span className="tr-mins">
                    <Timer size={11} /> {t("{n} min", { n: s.minutes })}
                  </span>
                  {title(s.resourceId) && (
                    <small className="muted">{title(s.resourceId)}</small>
                  )}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
