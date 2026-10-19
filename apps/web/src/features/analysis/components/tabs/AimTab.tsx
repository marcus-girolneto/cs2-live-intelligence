"use client";
import { useI18n } from "@/shared/i18n";
import { Crosshair, Headshot, Scope } from "@/shared/icons";
import { Panel, TabPanel } from "@/shared/ui";
import type { AnalysisVM } from "../../hooks/useAnalysisView";
import { aimLines } from "../../model/plain";
import { AimSummary } from "../AimSummary";
import { PlainSummary } from "../plain/PlainSummary";
import { BodyDiagram } from "../BodyDiagram";
import { NoDetail } from "../sections/NoDetail";
import { WeaponsTable } from "../sections/WeaponsTable";
/** Aim tab: hit groups, accuracy and weapons. */
export function AimTab({ vm }: { vm: AnalysisVM }) {
  const { t } = useI18n();
  const { refs, insight, headShare, idBase } = vm;
  return (
    <TabPanel idBase={idBase} id="aim">
      {insight.rich ? (
        <>
          <PlainSummary
            lines={aimLines({
              accuracy: insight.accuracy,
              accuracyRef: refs.accuracy,
              headShare,
              headRef: refs.share.head ?? null,
              hitgroups: insight.hitgroups,
            })}
          />
          <div className="aim-grid">
            <Panel
              icon={<Headshot size={20} />}
              title={t("Hit groups")}
              sub={t("Where your bullets landed (all guns)")}
            >
              {insight.hitgroups ? (
                <BodyDiagram
                  hits={insight.hitgroups}
                  total={insight.hitTotal}
                  compare={refs.share}
                />
              ) : (
                <p className="muted small">
                  {t("No hit-group data in this demo.")}
                </p>
              )}
              <p className="muted small">
                {t("The marker on each bar is the match average.")}
              </p>
            </Panel>
            <Panel icon={<Scope size={20} />} title={t("Accuracy")}>
              <AimSummary
                insight={insight}
                accuracyRef={refs.accuracy}
                headShare={headShare}
                headRef={refs.share.head ?? null}
                big
              />
            </Panel>
          </div>
          <Panel icon={<Crosshair size={20} />} title={t("Weapons")}>
            <WeaponsTable rows={insight.weapons} />
          </Panel>
        </>
      ) : (
        <NoDetail />
      )}
    </TabPanel>
  );
}
