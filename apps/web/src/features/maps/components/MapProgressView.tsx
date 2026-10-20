"use client";
import { useI18n } from "@/shared/i18n";
import { finite, formatDate, formatNumber } from "@/shared/format";
import { Crown, Globe, Target } from "@/shared/icons";
import { Panel } from "@/shared/ui";
import { PROGRESS_METRICS } from "../model/progress";
import { mapLabel, type MapProgress } from "../model/maps";
import type { PlanItem } from "../model/plan";
import { MapBadge } from "./MapBadge";
import { MapSwitcher } from "./MapSwitcher";
import { PlanList } from "./PlanList";

/** Progress by map: "All maps" overview or one map's metrics, patterns and open plan. */
export function MapProgressView({
  maps,
  general,
  value,
  onChange,
  lockedDeepLearning,
  onUpsell,
}: {
  maps: MapProgress[];
  general: PlanItem[];
  value: string | null;
  onChange: (map: string | null) => void;
  lockedDeepLearning: boolean;
  onUpsell: () => void;
}) {
  const { t, locale } = useI18n();
  const current = maps.find((m) => m.map === value) ?? null;
  return (
    <Panel
      className="map-progress"
      icon={<Globe size={20} />}
      title={t("By map")}
      sub={t(
        "General habits apply everywhere; map items only where you play them.",
      )}
    >
      <MapSwitcher
        maps={maps.map((m) => m.map)}
        value={current?.map ?? null}
        onChange={onChange}
      />
      {!current ? (
        <div className="mp-all">
          <section>
            <h4 className="plan-head">{t("General (all maps)")}</h4>
            {general.length ? (
              <PlanList items={general} />
            ) : (
              <p className="muted small">
                {t("Your general plan appears after your first AI review.")}
              </p>
            )}
          </section>
          {maps.length > 0 && (
            <div className="mp-cards">
              {maps.map((m) => {
                const adr = finite(m.metrics.adr?.recent);
                return (
                  <button
                    key={m.map}
                    type="button"
                    className="mp-card"
                    onClick={() => onChange(m.map)}
                  >
                    <MapBadge map={m.map} size={40} label={false} />
                    <span>
                      <strong>{mapLabel(m.map)}</strong>
                      <small>
                        {t("{n} matches", { n: m.matches })}
                        {m.lastPlayedAt
                          ? ` · ${formatDate(m.lastPlayedAt, locale) ?? ""}`
                          : ""}
                      </small>
                    </span>
                    <span className="mp-num">
                      <b>{adr === null ? "–" : formatNumber(adr, 0, locale)}</b>
                      <small>ADR</small>
                    </span>
                    {m.openPlanItems.length > 0 && (
                      <span className="chip accent">
                        {t("{n} open items", { n: m.openPlanItems.length })}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="mp-map">
          <ul className="mp-metrics">
            {PROGRESS_METRICS.map(({ key, label, unit, digits }) => {
              const m = current.metrics[key];
              const recent = finite(m?.recent);
              const overall = finite(m?.overall);
              const delta =
                recent !== null && overall !== null ? recent - overall : null;
              return (
                <li key={key}>
                  <span>{t(label)}</span>
                  <b>
                    {recent === null
                      ? "–"
                      : `${formatNumber(recent, digits, locale)}${unit ?? ""}`}
                  </b>
                  <small
                    className={
                      delta === null || Math.abs(delta) < 0.01
                        ? ""
                        : delta > 0
                          ? "up"
                          : "down"
                    }
                  >
                    {overall === null
                      ? t("No data")
                      : t("overall {v}", {
                          v: `${formatNumber(overall, digits, locale)}${unit ?? ""}`,
                        })}
                  </small>
                </li>
              );
            })}
          </ul>
          {lockedDeepLearning && (
            <button type="button" className="mp-lock" onClick={onUpsell}>
              <Crown size={16} />{" "}
              {t(
                "Per-map learning is a Pro feature. See what the coach learns about you on each map.",
              )}
            </button>
          )}
          <div className="grid-2">
            <section>
              <h4 className="plan-head">
                <Target size={16} />{" "}
                {t("{map} specific", {
                  map: mapLabel(current.map) ?? current.map,
                })}
              </h4>
              {current.openPlanItems.length ? (
                <PlanList items={current.openPlanItems} />
              ) : (
                <p className="muted small">
                  {t("No open items for this map yet. Review a match on it.")}
                </p>
              )}
              {current.recurring.length > 0 && (
                <ul className="recurring">
                  {current.recurring.map((r) => (
                    <li key={r.pattern}>
                      <span>{t(r.pattern)}</span>
                      <b>
                        {t("{n} of {m} matches", {
                          n: r.matches,
                          m: current.matches,
                        })}
                      </b>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h4 className="plan-head muted">{t("General (all maps)")}</h4>
              {general.length ? (
                <PlanList items={general} compact />
              ) : (
                <p className="muted small">–</p>
              )}
            </section>
          </div>
        </div>
      )}
    </Panel>
  );
}
