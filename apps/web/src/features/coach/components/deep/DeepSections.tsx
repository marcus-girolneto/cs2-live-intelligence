"use client";
import { useI18n } from "@/shared/i18n";
import { Crosshair, Flashbang, ListIcon, MapPin } from "@/shared/icons";
import type { ClipRef } from "../../model/coaching";
import type { DeepReview } from "../../model/deep";
import { CrosshairPanel } from "./CrosshairPanel";
import { HistoryChips } from "./HistoryChips";
import { PositioningPanel } from "./PositioningPanel";
import { RoundTable } from "./RoundTable";
import { UtilityLab } from "./UtilityLab";

/** Every Deep-only section of a review; each hides itself when its data is absent. */
export function DeepSections({
  deep,
  onPlay,
}: {
  deep: DeepReview;
  onPlay: (clip: ClipRef, title: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="deep-sections" data-testid="deep-sections">
      <HistoryChips chips={deep.history} />
      {deep.utility && (
        <section className="report-sec deep-sec" aria-labelledby="deep-utility">
          <h3 className="sec-title" id="deep-utility">
            <Flashbang size={20} /> {t("Utility lab")}
          </h3>
          <UtilityLab u={deep.utility} onPlay={onPlay} />
        </section>
      )}
      {deep.crosshair && (
        <section className="report-sec deep-sec" aria-labelledby="deep-xh">
          <h3 className="sec-title" id="deep-xh">
            <Crosshair size={20} /> {t("Crosshair placement")}
          </h3>
          <CrosshairPanel c={deep.crosshair} />
        </section>
      )}
      {deep.positioning && (
        <section className="report-sec deep-sec" aria-labelledby="deep-pos">
          <h3 className="sec-title" id="deep-pos">
            <MapPin size={20} /> {t("Positioning")}
          </h3>
          <PositioningPanel p={deep.positioning} onPlay={onPlay} />
        </section>
      )}
      {deep.rounds.length > 0 && (
        <section className="report-sec deep-sec" aria-labelledby="deep-rounds">
          <h3 className="sec-title" id="deep-rounds">
            <ListIcon size={20} /> {t("Round by round")}
          </h3>
          <RoundTable rounds={deep.rounds} onPlay={onPlay} />
        </section>
      )}
    </div>
  );
}
