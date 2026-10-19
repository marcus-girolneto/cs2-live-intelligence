"use client";
import { useI18n } from "@/shared/i18n";
import { MapPin, Radar } from "@/shared/icons";
import { Panel, TabPanel } from "@/shared/ui";
import type { AnalysisVM } from "../../hooks/useAnalysisView";
import { placeName } from "@/shared/format";
import { mapLines } from "../../model/plain";
import { MapPlot } from "../MapPlot";
import { PlainSummary } from "../plain/PlainSummary";
import { CalloutTable } from "../sections/CalloutTable";
import { NoDetail } from "../sections/NoDetail";
/** Map tab: kill/death positions and callouts. */
export function MapTab({ vm }: { vm: AnalysisVM }) {
  const { t } = useI18n();
  const { ghosts, map, insight, idBase, bestPlace, worstPlace } = vm;
  const named = (p: typeof bestPlace) =>
    p && { ...p, place: placeName(p.place) ?? p.place };
  return (
    <TabPanel idBase={idBase} id="map">
      <PlainSummary lines={mapLines(named(bestPlace), named(worstPlace))} />
      {insight.markers.length > 0 || insight.places.length > 0 ? (
        <div className="map-grid">
          {insight.markers.length > 0 && (
            <Panel
              icon={<Radar size={20} />}
              title={t("Kill & death positions")}
              className="map-panel"
            >
              <MapPlot
                markers={insight.markers}
                ghosts={ghosts}
                mapLabel={map}
              />
            </Panel>
          )}
          {insight.places.length > 0 && (
            <Panel
              icon={<MapPin size={20} />}
              title={t("Callouts")}
              sub={t("Kills made from and deaths suffered at each place")}
            >
              <div className="co-legend">
                <span>
                  <i className="d" /> {t("Deaths")}
                </span>
                <span>
                  <i className="k" /> {t("Kills")}
                </span>
              </div>
              <CalloutTable rows={insight.places} />
            </Panel>
          )}
        </div>
      ) : (
        <NoDetail />
      )}
    </TabPanel>
  );
}
