"use client";
import { useI18n } from "@/shared/i18n";
import { formatNumber, placeName } from "@/shared/format";
import type { DeepCrosshair } from "../../model/deep";
import { OffsetGauge } from "./OffsetGauge";

const PITCH: Record<"low" | "high" | "level", { label: string; tip: string }> =
  {
    low: {
      label: "Crosshair too low",
      tip: "Raise it to head height before you peek.",
    },
    high: {
      label: "Crosshair too high",
      tip: "Lower it a touch: most heads sit lower than you aim.",
    },
    level: {
      label: "Crosshair at head height",
      tip: "Good vertical placement. Keep it.",
    },
  };

/** Deep crosshair placement: offset gauge, % well pre-aimed, histogram, pitch, worst spots. */
export function CrosshairPanel({ c }: { c: DeepCrosshair }) {
  const { t, locale } = useI18n();
  const max = Math.max(1, ...c.histogram.map((b) => b.count));
  return (
    <div className="deep-block crosshair-panel">
      {c.summary && <p className="lead deep-summary">{c.summary}</p>}
      <div className="xh-grid">
        {c.medianOffset !== null && <OffsetGauge value={c.medianOffset} />}
        <div className="xh-stats">
          {c.wellPreAimed !== null && (
            <div className="xh-stat">
              <b className="tabular">
                {formatNumber(c.wellPreAimed, 0, locale)}%
              </b>
              <span>{t("of duels well pre-aimed")}</span>
              <span className="meter-mini" aria-hidden>
                <i style={{ width: `${c.wellPreAimed}%` }} />
              </span>
            </div>
          )}
          {c.duels !== null && (
            <div className="xh-stat">
              <b className="tabular">{formatNumber(c.duels, 0, locale)}</b>
              <span>{t("duels measured")}</span>
            </div>
          )}
          {c.pitch && (
            <div className={`xh-pitch ${c.pitch}`}>
              <span className="xh-pitch-scale" aria-hidden>
                <i className="xh-head" />
                <i className="xh-mark" />
              </span>
              <span>
                <strong>{t(PITCH[c.pitch].label)}</strong>
                {c.pitchBias !== null && c.pitch !== "level" && (
                  <small className="muted">
                    {" "}
                    {t("{n}° on average", {
                      n: formatNumber(Math.abs(c.pitchBias), 1, locale) ?? "–",
                    })}
                  </small>
                )}
                <small>{t(PITCH[c.pitch].tip)}</small>
              </span>
            </div>
          )}
        </div>
        {c.histogram.length > 0 && (
          <figure className="xh-hist">
            <div
              className="xh-bars"
              role="img"
              aria-label={t("Distribution of pre-aim offsets")}
            >
              {c.histogram.map((b) => (
                <span
                  key={b.label}
                  className={`xh-bar ${b.from !== null && b.from >= 6 ? "bad" : b.from !== null && b.from >= 3 ? "warn" : "good"}`}
                >
                  <i style={{ height: `${(b.count / max) * 100}%` }} />
                  <b className="tabular">{b.count}</b>
                  <small>
                    {b.from === null
                      ? b.label
                      : b.to === null
                        ? `${formatNumber(b.from, b.from % 1 ? 1 : 0, locale)}°+`
                        : `${formatNumber(b.from, b.from % 1 ? 1 : 0, locale)}–${formatNumber(b.to, b.to % 1 ? 1 : 0, locale)}°`}
                  </small>
                </span>
              ))}
            </div>
            <figcaption className="muted small">
              {t("Duels by how far your crosshair was from the enemy's head")}
            </figcaption>
          </figure>
        )}
      </div>
      {c.worst.length > 0 && (
        <>
          <h4 className="deep-sub">{t("Where your crosshair drifts most")}</h4>
          <ul className="xh-worst">
            {c.worst.slice(0, 6).map((w) => (
              <li key={w.place}>
                <strong>{placeName(w.place) ?? w.place}</strong>
                <span className="tabular">
                  {w.offset !== null
                    ? `${formatNumber(w.offset, 1, locale)}°`
                    : "–"}
                </span>
                {w.duels !== null && (
                  <small className="muted">
                    {t("{n} duels", {
                      n: formatNumber(w.duels, 0, locale) ?? "–",
                    })}
                  </small>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
