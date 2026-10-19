"use client";
import { useI18n } from "@/shared/i18n";
import { formatNumber, placeName } from "@/shared/format";
import { Play, Skull } from "@/shared/icons";
import type { ClipRef } from "../../model/coaching";
import type { DeepPositioning } from "../../model/deep";

/** Deep: isolation / crossfire / traded stats and the danger zones (with clips). */
export function PositioningPanel({
  p,
  onPlay,
}: {
  p: DeepPositioning;
  onPlay: (clip: ClipRef, title: string) => void;
}) {
  const { t, locale } = useI18n();
  const stats = [
    {
      v: p.isolation,
      label: t("Deaths while isolated"),
      tone: "bad",
    },
    {
      v: p.crossfire,
      label: t("Fights taken in a crossfire"),
      tone: "good",
    },
    { v: p.traded, label: t("Deaths traded by a teammate"), tone: "good" },
  ].filter((s) => s.v !== null);
  return (
    <div className="deep-block positioning-panel">
      {p.summary && <p className="lead deep-summary">{p.summary}</p>}
      {stats.length > 0 && (
        <ul className="pos-stats">
          {stats.map((s) => (
            <li key={s.label} className={s.tone}>
              <b className="tabular">{formatNumber(s.v, 0, locale)}%</b>
              <span>{s.label}</span>
              <span className="meter-mini" aria-hidden>
                <i style={{ width: `${s.v}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {p.zones.length > 0 && (
        <>
          <h4 className="deep-sub">{t("Danger zones")}</h4>
          <ol className="zones">
            {p.zones.map((z, i) => {
              const name = placeName(z.place) ?? z.place;
              return (
                <li key={`${z.place}-${i}`} className="zone">
                  <span className="zone-rank" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="zone-text">
                    <strong>{name}</strong>
                    <small className="muted">
                      {[
                        z.deaths !== null
                          ? t("{n} deaths", {
                              n: formatNumber(z.deaths, 0, locale) ?? "—",
                            })
                          : null,
                        z.rounds.length
                          ? t("rounds {list}", {
                              list: z.rounds.slice(0, 8).join(", "),
                            })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                    {z.why && <span className="zone-why">{z.why}</span>}
                  </span>
                  {z.clip ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => onPlay(z.clip!, name)}
                    >
                      <Play size={16} /> {t("Watch clip")}
                    </button>
                  ) : (
                    <Skull size={18} className="zone-skull" />
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
