"use client";
import { useI18n } from "@/shared/i18n";
import { Globe } from "@/shared/icons";
import { MapBadge, PlanList, mapLabel } from "@/features/maps";
import { byScope, type PlanItem } from "../model/coaching";

/** "Plan for your next match": general items and items for this map. */
export function PlanBoard({
  plan,
  map,
}: {
  plan: PlanItem[];
  map: string | null;
}) {
  const { t } = useI18n();
  const { general, map: specific } = byScope(plan);
  if (!plan.length) return null;
  return (
    <div className={`plan-board ${specific.length ? "split" : ""}`}>
      {general.length > 0 && (
        <section>
          <h4 className="plan-head">
            <Globe size={16} /> {t("General (all maps)")}
          </h4>
          <PlanList items={general} />
        </section>
      )}
      {specific.length > 0 && (
        <section>
          <h4 className="plan-head">
            <MapBadge map={specific[0]?.map ?? map} size={18} label={false} />
            {t("{map} specific", {
              map: mapLabel(specific[0]?.map ?? map) ?? t("Map"),
            })}
          </h4>
          <PlanList items={specific} start={general.length + 1} />
        </section>
      )}
    </div>
  );
}
