"use client";
import Link from "next/link";
import { useUsage } from "@/features/billing";
import { useI18n } from "@/shared/i18n";
import { ArrowRight, Crown, Star } from "@/shared/icons";
import { usePersonalCoach } from "../hooks/usePersonalCoach";

/** Dashboard card: the latest Personal Coach headline (Pro) or a teaser with the player's count. */
export function PersonalCoachCard({ matches }: { matches: number | null }) {
  const { t } = useI18n();
  const { limits, isAdmin } = useUsage();
  const pro = isAdmin || !!limits?.personalCoach;
  const { state } = usePersonalCoach(pro);
  const plan = state?.latest ?? null;
  const focus = plan?.focusAreas[0];
  return (
    <Link
      href="/coach/personal"
      className={`pc-card ${pro ? "pro" : "locked"}`}
      data-testid="personal-card"
    >
      <span className="pc-card-eyebrow">
        <Star size={14} /> {t("Personal Coach")}
        {!pro && <span className="nav-badge">{t("Pro")}</span>}
      </span>
      {pro ? (
        <>
          <strong>
            {plan?.headline || t("Get one plan written from all your matches")}
          </strong>
          {focus && (
            <small>
              {t("Focus")}: {focus.area}
            </small>
          )}
          <span className="pc-card-cta">
            {plan ? t("Open my plan") : t("Write my plan")}{" "}
            <ArrowRight size={14} />
          </span>
        </>
      ) : (
        <>
          <strong>
            {matches && matches > 0
              ? t(
                  "We've seen {n} of your matches — unlock your Personal Coach",
                  {
                    n: matches,
                  },
                )
              : t("Your Personal Coach learns from every match you upload")}
          </strong>
          <small>{t("A multi-week training program written for you.")}</small>
          <span className="pc-card-cta">
            <Crown size={14} /> {t("See what you get")} <ArrowRight size={14} />
          </span>
        </>
      )}
    </Link>
  );
}
