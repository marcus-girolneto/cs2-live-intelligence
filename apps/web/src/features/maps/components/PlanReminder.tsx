"use client";
import { useI18n } from "@/shared/i18n";
import { BRAND } from "@/shared/brand";
import { Target } from "@/shared/icons";
import { mapLabel, planFor } from "../model/maps";
import { useCoachProgress } from "../hooks/useCoachProgress";
import { MapBadge } from "./MapBadge";
import { PlanList } from "./PlanList";

/** Second screen: the general plan plus the items for the map being played. */
export function PlanReminder({ map }: { map: string | null | undefined }) {
  const { t } = useI18n();
  const { progress } = useCoachProgress();
  const plan = planFor(progress, map ?? null);
  if (!plan.general.length && !plan.map.length) return null;
  return (
    <section
      className="plan-reminder"
      aria-label={t("Your plan for this match")}
    >
      <h3>
        <Target size={18} /> {t("{coach} plan", { coach: BRAND.coach })}
      </h3>
      {plan.map.length > 0 && (
        <>
          <h4 className="plan-head">
            <MapBadge map={map} size={18} label={false} />
            {t("{map} specific", { map: mapLabel(map) ?? "" })}
          </h4>
          <PlanList items={plan.map} compact />
        </>
      )}
      {plan.general.length > 0 && (
        <>
          <h4 className="plan-head muted">{t("General (all maps)")}</h4>
          <PlanList items={plan.general} compact />
        </>
      )}
    </section>
  );
}
