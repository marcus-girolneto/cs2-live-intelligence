"use client";
import { useEffect, useState } from "react";
import { useUsage } from "@/features/billing";
import { useI18n } from "@/shared/i18n";
import { useAccount } from "@/shared/session";
import { Brain, Sparkle, Star } from "@/shared/icons";
import {
  Callout,
  DefuseLoader,
  EmptyState,
  PageHeader,
  PageLoader,
} from "@/shared/ui";
import { usePersonalCoach } from "../hooks/usePersonalCoach";
import { useTeaserCounts } from "../hooks/useTeaserCounts";
import { coolingDown } from "../model/personal";
import { FocusAreas } from "./FocusAreas";
import { PerMapNotes } from "./PerMapNotes";
import { PersonalHero } from "./PersonalHero";
import { PersonalTeaser } from "./PersonalTeaser";
import { PointColumns } from "./PointColumns";
import { WeeklyProgram } from "./WeeklyProgram";

/** /coach/personal: the Personal Coach plan (Pro) or its locked teaser. */
export function PersonalCoachScreen() {
  const { t, locale } = useI18n();
  const { limits, isAdmin } = useUsage();
  const { account } = useAccount();
  const known = !!account;
  const pro = isAdmin || !!limits?.personalCoach;
  const p = usePersonalCoach(pro, known && !pro);
  const listed = useTeaserCounts();
  // The API's teaser counts win; the match list fills in the map count.
  const counts =
    p.teaser?.analyzedMatches != null
      ? {
          matches: p.teaser.analyzedMatches,
          maps: listed?.maps ?? 0,
          reviews: p.teaser.reviews,
        }
      : listed;
  const [since, setSince] = useState(0);
  useEffect(() => {
    if (p.generating) setSince(Date.now());
  }, [p.generating]);
  const plan = p.state?.latest ?? null;
  const steps = [
    t("Reading all your matches…"),
    t("Finding what keeps working…"),
    t("Spotting the leaks that repeat…"),
    t("Writing your training program…"),
  ];
  return (
    <main className="page personal-page">
      <PageHeader
        eyebrow={t("Personal Coach")}
        icon={<Star size={16} />}
        title={t("Your Personal Coach")}
        lead={t(
          "One plan from all of your matches: what's working, what isn't, where to focus and a week-by-week program.",
        )}
      />
      {p.error && <Callout tone="error">{t(p.error)}</Callout>}
      {!known ? (
        <PageLoader />
      ) : !pro ? (
        <PersonalTeaser counts={counts} />
      ) : p.generating ? (
        <div className="pc-generating">
          <DefuseLoader
            since={since || Date.now()}
            title={t("Your Personal Coach is writing your plan")}
            steps={steps}
          />
        </div>
      ) : p.state === null ? (
        <PageLoader />
      ) : !plan ? (
        <EmptyState
          icon={<Brain size={28} />}
          title={t("No plan yet")}
          actions={
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => void p.generate()}
            >
              <Sparkle size={18} /> {t("Write my plan")}
            </button>
          }
        >
          {t(
            "Your Personal Coach reads every analyzed match and writes one plan for the next weeks.",
          )}
        </EmptyState>
      ) : (
        <div className="pc-plan" data-testid="personal-plan">
          <PersonalHero
            plan={plan}
            nextAllowedAt={p.state.nextAllowedAt}
            newMatches={p.state.newMatchesSinceLast}
            autoAfter={p.state.autoRegenerateAfterMatches}
            cooling={coolingDown(p.state)}
            busy={p.generating}
            onRegenerate={() => void p.generate()}
          />
          <PointColumns
            working={plan.workingWell}
            notWorking={plan.notWorking}
          />
          <FocusAreas areas={plan.focusAreas} />
          <WeeklyProgram
            weeks={plan.weeklyProgram}
            planKey={plan.generatedAt ?? plan.headline.slice(0, 40)}
          />
          <PerMapNotes maps={plan.perMap} />
          {plan.caveats.length > 0 && (
            <ul className="rd-caveats muted small">
              {plan.caveats.map((c) => (
                <li key={c}>{t(c)}</li>
              ))}
            </ul>
          )}
          {plan.nextReviewSuggestion && (
            <Callout tone="info">
              <b>{t("Next check-in")}:</b> {plan.nextReviewSuggestion}
            </Callout>
          )}
          {p.state.history.length > 1 && (
            <details className="pc-history">
              <summary>{t("Earlier plans")}</summary>
              <ul>
                {p.state.history.slice(1).map((h) => (
                  <li key={h.id}>
                    <span>{h.headline}</span>
                    {h.generatedAt && (
                      <small className="muted">
                        {new Date(h.generatedAt).toLocaleDateString(locale)}
                      </small>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </main>
  );
}
