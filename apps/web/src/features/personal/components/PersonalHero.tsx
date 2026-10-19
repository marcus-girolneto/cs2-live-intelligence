"use client";
import { formatDate } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Brain, Clock, Refresh, Star } from "@/shared/icons";
import type { PersonalPlan } from "../model/personal";

/** Headline of the plan, how many matches it is based on and the regenerate action. */
export function PersonalHero({
  plan,
  nextAllowedAt,
  newMatches = null,
  autoAfter = null,
  cooling,
  busy,
  onRegenerate,
}: {
  plan: PersonalPlan;
  nextAllowedAt: string | null;
  newMatches?: number | null;
  autoAfter?: number | null;
  cooling: boolean;
  busy: boolean;
  onRegenerate: () => void;
}) {
  const { t, locale } = useI18n();
  const when = formatDate(plan.generatedAt, locale);
  const next = formatDate(nextAllowedAt, locale);
  return (
    <section className="pc-hero" aria-labelledby="pc-headline">
      <div className="pc-hero-mark" aria-hidden>
        <Brain size={34} />
      </div>
      <div className="pc-hero-body">
        <p className="pc-eyebrow">
          <Star size={14} /> {t("Your Personal Coach")}
          {plan.basedOnMatches !== null && (
            <span className="pc-based">
              {plan.basedOnMatches === 1
                ? t("based on 1 match")
                : t("based on {n} matches", { n: plan.basedOnMatches })}
            </span>
          )}
        </p>
        <h2 id="pc-headline">
          {plan.headline || t("Your plan for the next weeks")}
        </h2>
        {when && (
          <p className="pc-when">
            <Clock size={13} /> {t("Written {date}", { date: when })}
          </p>
        )}
      </div>
      <div className="pc-hero-act">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onRegenerate}
          disabled={busy || cooling}
        >
          <Refresh size={16} /> {t("Rewrite my plan")}
        </button>
        {newMatches !== null && newMatches > 0 && (
          <small className="pc-new">
            {newMatches === 1
              ? t("1 new match since this plan")
              : t("{n} new matches since this plan", { n: newMatches })}
          </small>
        )}
        {autoAfter !== null && autoAfter > 0 && (
          <small className="muted">
            {t("Rewrites itself after {n} new matches", { n: autoAfter })}
          </small>
        )}
        {cooling && next && (
          <small className="muted">
            {t("Next rewrite available {date}", { date: next })}
          </small>
        )}
      </div>
    </section>
  );
}
