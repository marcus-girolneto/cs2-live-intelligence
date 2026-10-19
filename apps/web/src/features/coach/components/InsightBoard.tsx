"use client";
import { useI18n } from "@/shared/i18n";
import { Crosshair, Film, Globe, Target, Trophy } from "@/shared/icons";
import { MapBadge, mapLabel } from "@/features/maps";
import { byScope, type ClipRef, type CoachInsight } from "../model/coaching";

/** Priority insight cards, split into "General (all maps)" and "<Map> specific". */
export function InsightBoard({
  insights,
  map,
  roundsFor,
  onPlay,
}: {
  insights: CoachInsight[];
  map: string | null;
  roundsFor: (evidenceIds: string[]) => number[];
  onPlay: (clip: ClipRef, title: string) => void;
}) {
  const { t } = useI18n();
  const { general, map: specific } = byScope(
    // Fixes first, strengths after.
    [...insights].sort((a, b) =>
      a.kind === b.kind ? 0 : a.kind === "improve" ? -1 : 1,
    ),
  );
  const card = (x: CoachInsight, i: number) => {
    const rounds = roundsFor(x.evidenceIds);
    return (
      <article key={i} className={`coach-card ${x.kind}`}>
        <header>
          <span className="coach-kind">
            {x.kind === "strength" ? (
              <Trophy size={18} />
            ) : (
              <Crosshair size={18} />
            )}
            {x.kind === "strength" ? t("Strength") : t("To improve")}
          </span>
          {x.confidence && (
            <span className={`confidence ${x.confidence}`}>
              {t("Confidence: {level}", { level: t(x.confidence) })}
            </span>
          )}
        </header>
        <h4>{x.observation}</h4>
        {x.actionablePractice && (
          <p className="practice">
            <span className="practice-label">
              <Target size={14} /> {t("Practice")}
            </span>
            {x.actionablePractice}
          </p>
        )}
        <footer>
          {rounds.length > 0 ? (
            <span className="evidence-chip static">
              {t("Evidence: rounds {rounds}", { rounds: rounds.join(", ") })}
            </span>
          ) : x.evidenceIds.length > 0 ? (
            <span className="evidence-chip static">
              {t("Evidence: {n} metric(s)", { n: x.evidenceIds.length })}
            </span>
          ) : null}
          {x.clips[0] && (
            <button
              type="button"
              className="btn btn-ghost btn-sm watch-clip"
              onClick={() => onPlay(x.clips[0]!, x.observation)}
            >
              <Film size={16} /> {t("Watch clip")}
            </button>
          )}
        </footer>
      </article>
    );
  };
  return (
    <>
      {general.length > 0 && (
        <section className="scope-block">
          <h3 className="scope-head">
            <Globe size={18} /> {t("General (all maps)")}
          </h3>
          <div className="coach-grid stagger">{general.map(card)}</div>
        </section>
      )}
      {specific.length > 0 && (
        <section className="scope-block map">
          <h3 className="scope-head">
            <MapBadge map={map} size={22} label={false} />
            {t("{map} specific", { map: mapLabel(map) ?? t("Map") })}
          </h3>
          <div className="coach-grid stagger">{specific.map(card)}</div>
        </section>
      )}
    </>
  );
}
