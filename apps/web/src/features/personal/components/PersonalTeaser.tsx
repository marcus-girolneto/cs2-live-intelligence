"use client";
import Link from "next/link";
import { useUpgrade } from "@/features/billing";
import { useI18n } from "@/shared/i18n";
import { Brain, Check, Crown, Lock, Upload } from "@/shared/icons";
import { SAMPLE_PLAN } from "../model/sample";
import { FocusAreas } from "./FocusAreas";
import { PointColumns } from "./PointColumns";

/** Locked Personal Coach for non-Pro players, built from their real match count. */
export function PersonalTeaser({
  counts,
}: {
  counts: { matches: number; maps: number; reviews?: number | null } | null;
}) {
  const { t } = useI18n();
  const upgrade = useUpgrade();
  const seen = counts?.matches ?? 0;
  const gains = [
    t("What's working and what isn't, across all your matches"),
    t("Focus areas with a current → target for each"),
    t("A week-by-week training program with drills"),
    t("Notes for every map you play"),
  ];
  return (
    <section className="pc-teaser" data-testid="personal-teaser">
      <div className="pc-teaser-hero">
        <div className="pc-seen" aria-hidden={counts === null}>
          <b>{counts === null ? "–" : seen}</b>
          <span>
            {seen === 1 ? t("match analyzed") : t("matches analyzed")}
          </span>
          {counts !== null && counts.maps > 0 && (
            <small>
              {counts.maps === 1
                ? t("on 1 map")
                : t("on {n} maps", { n: counts.maps })}
            </small>
          )}
          {counts?.reviews != null && counts.reviews > 0 && (
            <small>
              {counts.reviews === 1
                ? t("1 AI review to learn from")
                : t("{n} AI reviews to learn from", { n: counts.reviews })}
            </small>
          )}
        </div>
        <div className="pc-teaser-copy">
          <p className="pc-eyebrow">
            <Lock size={14} /> {t("Pro")}
          </p>
          <h2>
            {seen > 0
              ? t(
                  "We've seen {n} of your matches. Your Personal Coach is ready",
                  {
                    n: seen,
                  },
                )
              : t("Your Personal Coach learns from every match you upload")}
          </h2>
          <p className="muted">
            {t(
              "A second AI coach reads all of your matches together and writes one plan: your strengths, your leaks and a multi-week program to fix them.",
            )}
          </p>
          <ul className="pc-gains">
            {gains.map((g) => (
              <li key={g}>
                <Check size={15} /> {g}
              </li>
            ))}
          </ul>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() =>
                upgrade.open({ feature: "personal_coach", limit: 0 })
              }
            >
              <Crown size={20} /> {t("Get Personal Coach with Pro")}
            </button>
            {seen === 0 && (
              <Link className="btn btn-ghost" href="/upload">
                <Upload size={16} /> {t("Upload a demo")}
              </Link>
            )}
          </div>
        </div>
      </div>
      <div className="pc-teaser-preview" aria-hidden="true" inert>
        <div className="pc-hero sample">
          <div className="pc-hero-mark">
            <Brain size={34} />
          </div>
          <div className="pc-hero-body">
            <h2>{t(SAMPLE_PLAN.headline)}</h2>
          </div>
        </div>
        <PointColumns
          working={SAMPLE_PLAN.workingWell}
          notWorking={SAMPLE_PLAN.notWorking}
        />
        <FocusAreas areas={SAMPLE_PLAN.focusAreas} />
      </div>
    </section>
  );
}
