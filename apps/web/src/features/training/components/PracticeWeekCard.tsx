"use client";
import Link from "next/link";
import { useI18n } from "@/shared/i18n";
import { ArrowRight, Dumbbell } from "@/shared/icons";
import { useCatalog, useRecommended } from "../hooks/useTraining";
import { PracticeWeek } from "./PracticeWeek";

/** Personal Coach: the pro-team week built from your latest matches (hidden without data). */
export function PracticeWeekCard() {
  const { t } = useI18n();
  const rec = useRecommended();
  const catalog = useCatalog();
  if (!rec.data?.week.length) return null;
  return (
    <section
      className="report-sec"
      aria-labelledby="tr-week-title"
      data-testid="practice-week-card"
    >
      <h2 className="sec-title" id="tr-week-title">
        <Dumbbell size={18} /> {t("Pro-team week")}
      </h2>
      <p className="muted small">
        {t(
          "Every practice day: review, warmup, area habit, focused block, debrief. Take a short break every hour, drink water, sleep.",
        )}
      </p>
      <PracticeWeek
        week={rec.data.week}
        resources={catalog.data?.resources ?? []}
      />
      <Link className="btn btn-ghost btn-sm" href="/training">
        {t("Open training")} <ArrowRight size={14} />
      </Link>
    </section>
  );
}
