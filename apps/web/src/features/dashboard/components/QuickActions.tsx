"use client";
import Link from "next/link";
import { useI18n } from "@/shared/i18n";
import { Brain, Chart, Gear, Monitor, Upload } from "@/shared/icons";
/** Shortcut cards to the main areas. */
export function QuickActions() {
  const { t } = useI18n();
  return (
    <section className="quick-actions stagger" aria-label={t("Next actions")}>
      <Link href="/coach" className="qa qa-star">
        <Brain size={26} />
        <strong>{t("Get your AI review")}</strong>
        <span>
          {t("Scores, key moments as 2D replays, drills and a plan.")}
        </span>
      </Link>
      <Link href="/upload" className="qa">
        <Upload size={26} />
        <strong>{t("Upload a demo")}</strong>
        <span>
          {t("Drop your .dem and get the full breakdown in seconds.")}
        </span>
      </Link>
      <Link href="/live" className="qa">
        <Monitor size={26} />
        <strong>{t("Open the second screen")}</strong>
        <span>{t("Live HUD and AI IGL calls between rounds.")}</span>
      </Link>
      <Link href="/progress" className="qa">
        <Chart size={26} />
        <strong>{t("Track progress")}</strong>
        <span>{t("See how your numbers move match after match.")}</span>
      </Link>
      <Link href="/settings#coach" className="qa">
        <Gear size={26} />
        <strong>{t("Tune your coach")}</strong>
        <span>{t("Style, tone, role and focus areas for every review.")}</span>
      </Link>
    </section>
  );
}
