"use client";
import { useMemo, useState } from "react";
import { useI18n } from "@/shared/i18n";
import type { Progress } from "../model/progress";
import { mapLabel, mapsOf, planFor } from "../model/maps";
import { MapBadge } from "./MapBadge";
import { MapSwitcher } from "./MapSwitcher";
import { PlanList } from "./PlanList";

/** Dashboard "Coach's plan": general items, or one map's items + the general ones compact. */
export function MapPlanPanel({ progress }: { progress: Progress }) {
  const { t } = useI18n();
  const [map, setMap] = useState<string | null>(null);
  const maps = useMemo(() => mapsOf(progress).map((m) => m.map), [progress]);
  const plan = useMemo(() => planFor(progress, map), [progress, map]);
  return (
    <div className="map-plan">
      {maps.length > 1 && (
        <MapSwitcher maps={maps} value={map} onChange={setMap} />
      )}
      {map ? (
        <>
          <h4 className="plan-head">
            <MapBadge map={map} size={18} label={false} />
            {t("{map} specific", { map: mapLabel(map) ?? map })}
          </h4>
          {plan.map.length ? (
            <PlanList items={plan.map} />
          ) : (
            <p className="muted small">
              {t("No open items for this map yet. Review a match on it.")}
            </p>
          )}
          {plan.general.length > 0 && (
            <>
              <h4 className="plan-head muted">{t("General (all maps)")}</h4>
              <PlanList items={plan.general} compact />
            </>
          )}
        </>
      ) : (
        <PlanList items={plan.general.slice(0, 4)} />
      )}
    </div>
  );
}
