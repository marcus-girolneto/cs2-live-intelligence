"use client";
import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/shared/i18n";
import { mapName } from "@/shared/format";
import { ArrowRight, Dumbbell, Star } from "@/shared/icons";
import { Callout, EmptyState, PageHeader, Skeleton } from "@/shared/ui";
import { useCatalog, useRecommended } from "../hooks/useTraining";
import { skillLabel } from "../model/copy";
import { catalogMaps, filterResources } from "../model/filter";
import { SKILLS, type Skill } from "../model/types";
import { PracticeWeek } from "./PracticeWeek";
import { ResourceCard } from "./ResourceCard";
import { TrainingPlanView } from "./TrainingPlanView";

/** /training: recommended practice from your latest matches + the verified catalog. */
export function TrainingScreen() {
  const { t } = useI18n();
  const catalog = useCatalog();
  const rec = useRecommended();
  const [skill, setSkill] = useState<Skill | "all">("all");
  const [map, setMap] = useState<string>("all");
  const resources = catalog.data?.resources ?? [];
  const shown = filterResources(resources, skill, map);
  const latest = rec.data?.latest ?? null;
  return (
    <main className="page training-page">
      <PageHeader
        eyebrow={t("Train")}
        icon={<Dumbbell size={16} />}
        title={t("Train like a pro team")}
        lead={t(
          "Practice maps checked on Steam, your own spots from your demos and a session plan with a goal.",
        )}
      />
      <section className="report-sec" aria-labelledby="tr-rec">
        <h2 className="sec-title" id="tr-rec">
          <Star size={18} /> {t("Recommended for you")}
        </h2>
        {rec.loading ? (
          <Skeleton height={160} />
        ) : latest ? (
          <>
            <p className="muted small">
              {t("From your latest match on {map}.", {
                map: mapName(latest.map) ?? latest.map ?? t("this map"),
              })}{" "}
              {rec.data!.focus.length > 0 &&
                t("Your weakest skills lately: {list}.", {
                  list: rec.data!.focus.map((s) => skillLabel(s, t)).join(", "),
                })}
            </p>
            <TrainingPlanView
              plan={latest.plan}
              resources={resources}
              analysisId={latest.analysisId}
            />
            <h3 className="tr-sub">{t("Your week")}</h3>
            <PracticeWeek week={rec.data!.week} resources={resources} />
          </>
        ) : (
          <EmptyState
            compact
            icon={<Dumbbell size={24} />}
            title={t("No recommendations yet")}
            actions={
              <Link className="btn btn-ghost btn-sm" href="/coach">
                {t("Open the AI Coach")} <ArrowRight size={14} />
              </Link>
            }
          >
            {t(
              "Upload a match and tell the coach which player you are: your plan appears here.",
            )}
          </EmptyState>
        )}
      </section>
      <section className="report-sec" aria-labelledby="tr-cat">
        <h2 className="sec-title" id="tr-cat">
          <Dumbbell size={18} /> {t("Practice catalog")}
        </h2>
        {catalog.error && <Callout tone="error">{t(catalog.error)}</Callout>}
        <div
          className="tr-filters"
          role="group"
          aria-label={t("Filter by skill")}
        >
          {(["all", ...SKILLS] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={`chip${skill === s ? " accent" : ""}`}
              aria-pressed={skill === s}
              onClick={() => setSkill(s)}
            >
              {s === "all" ? t("All skills") : skillLabel(s, t)}
            </button>
          ))}
          <label className="tr-map-filter">
            <span className="visually-hidden">{t("Map")}</span>
            <select value={map} onChange={(e) => setMap(e.target.value)}>
              <option value="all">{t("All maps")}</option>
              {catalogMaps(resources).map((m) => (
                <option key={m} value={m}>
                  {mapName(m) ?? m}
                </option>
              ))}
            </select>
          </label>
        </div>
        {catalog.loading ? (
          <Skeleton height={200} />
        ) : (
          <div className="tr-grid">
            {shown.map((r) => (
              <ResourceCard key={r.id} r={r} />
            ))}
          </div>
        )}
        <p className="muted small">
          {t(
            "Every Workshop map is checked on Steam (title, CS2, not removed). Subscribe, then Play, Workshop Maps, or paste the copied command in the console.",
          )}
        </p>
      </section>
    </main>
  );
}
