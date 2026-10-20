"use client";
import { formatNumber, placeName } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { MapPin, Skull, Target, WeaponIcon } from "@/shared/icons";
import { Panel } from "@/shared/ui";
import type { AnalysisVM } from "../../hooks/useAnalysisView";
import { AimSummary } from "../AimSummary";
import { BodyDiagram } from "../BodyDiagram";
import { EconomyPanel } from "../sections/EconomyPanel";
import { NoDetail } from "../sections/NoDetail";
import { TimingPanel } from "../sections/TimingPanel";
import { UtilityPanel } from "../sections/UtilityPanel";
/** Aim snapshot, timing, best/worst spots, utility and economy. */
export function OverviewInsights({ vm }: { vm: AnalysisVM }) {
  const { t, locale } = useI18n();
  const num = (v: unknown, d = 0) => formatNumber(v, d, locale);
  const {
    setTab,
    refs,
    insight,
    headShare,
    bestWeapon,
    bestPlace,
    worstPlace,
    openingRecord,
  } = vm;
  return (
    <>
      {insight.rich ? (
        <>
          <div className="ov-grid">
            <Panel
              icon={<Target size={20} />}
              title={t("Aim snapshot")}
              actions={
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setTab("aim")}
                >
                  {t("Full aim breakdown")}
                </button>
              }
            >
              <AimSummary
                insight={insight}
                accuracyRef={refs.accuracy}
                headShare={headShare}
                headRef={refs.share.head ?? null}
              />
              {insight.hitgroups && (
                <BodyDiagram
                  hits={insight.hitgroups}
                  total={insight.hitTotal}
                  compare={refs.share}
                  compact
                />
              )}
            </Panel>
            <div className="ov-col">
              <TimingPanel
                insight={insight}
                avgOpening={refs.opening}
                avgDeath={refs.death}
                openingRecord={openingRecord}
              />
              {(bestPlace || bestWeapon) && (
                <Panel
                  icon={<MapPin size={20} />}
                  title={t("Where you win and lose")}
                  actions={
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setTab("map")}
                    >
                      {t("Open map")}
                    </button>
                  }
                >
                  <ul className="highlights">
                    {bestWeapon && (
                      <li className="good">
                        <WeaponIcon cls={bestWeapon.cls} size={16} />
                        <span>
                          {t("Best weapon: {w} ({k} kills)", {
                            w: bestWeapon.name,
                            k: bestWeapon.kills,
                          })}
                          {bestWeapon.accuracy !== null &&
                            `, ${t("{a}% accuracy", { a: num(bestWeapon.accuracy)! })}`}
                        </span>
                      </li>
                    )}
                    {bestPlace && bestPlace.kills > bestPlace.deaths && (
                      <li className="good">
                        <MapPin size={16} />
                        <span>
                          {t("Strongest spot: {p} ({k} kills, {d} deaths)", {
                            p: placeName(bestPlace.place) ?? bestPlace.place,
                            k: bestPlace.kills,
                            d: bestPlace.deaths,
                          })}
                        </span>
                      </li>
                    )}
                    {worstPlace && worstPlace.deaths > worstPlace.kills && (
                      <li className="bad">
                        <Skull size={16} />
                        <span>
                          {t("Weakest spot: {p} ({k} kills, {d} deaths)", {
                            p: placeName(worstPlace.place) ?? worstPlace.place,
                            k: worstPlace.kills,
                            d: worstPlace.deaths,
                          })}
                        </span>
                      </li>
                    )}
                  </ul>
                </Panel>
              )}
            </div>
          </div>
          <div className="grid-2">
            <UtilityPanel insight={insight} />
            <EconomyPanel insight={insight} />
          </div>
        </>
      ) : (
        <NoDetail />
      )}
    </>
  );
}
