"use client";
import { useI18n } from "@/shared/i18n";
import { formatNumber, placeName } from "@/shared/format";
import { Play } from "@/shared/icons";
import type { ClipRef } from "../../model/coaching";
import type { DeepUtility } from "../../model/deep";
import { lineupTitle, lineupWhy } from "../../model/deepText";
import { NadeIcon, NADE_LABEL, clock } from "./nades";
import { NadePlot } from "./NadePlot";

const VERDICT: Record<string, string> = {
  good: "Useful",
  wasted: "Wasted",
  harmful: "Hurt your team",
};

/** Deep: grenade log, efficiency per type, landing plot and lineups to learn. */
export function UtilityLab({
  u,
  onPlay,
}: {
  u: DeepUtility;
  onPlay: (clip: ClipRef, title: string) => void;
}) {
  const { t, locale } = useI18n();
  const n = (v: number | null, d = 0) => formatNumber(v, d, locale) ?? "–";
  return (
    <div className="deep-block utility-lab">
      {u.summary && <p className="lead deep-summary">{u.summary}</p>}
      {(u.perType.length > 0 || u.efficiency !== null) && (
        <ul className="nade-stats">
          {u.efficiency !== null && (
            <li className="nade-stat total">
              <span className="ns-label">{t("Utility efficiency")}</span>
              <b className="tabular">{n(u.efficiency)}%</b>
              <span className="meter-mini" aria-hidden>
                <i style={{ width: `${u.efficiency}%` }} />
              </span>
            </li>
          )}
          {u.perType.map((s) => (
            <li key={s.type} className="nade-stat">
              <span className="ns-label">
                <NadeIcon type={s.type} /> {t(NADE_LABEL[s.type])}
              </span>
              <b className="tabular">{n(s.thrown)}</b>
              <small className="muted">
                {[
                  s.effective !== null
                    ? t("{n} useful", { n: n(s.effective) })
                    : null,
                  s.enemiesFlashed !== null
                    ? t("{n} enemies flashed", { n: n(s.enemiesFlashed) })
                    : null,
                  s.blindSeconds !== null
                    ? t("{n} s blind", { n: n(s.blindSeconds, 1) })
                    : null,
                  s.damage !== null ? t("{n} dmg", { n: n(s.damage) }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
              {s.efficiency !== null && (
                <span className="meter-mini" aria-label={`${n(s.efficiency)}%`}>
                  <i style={{ width: `${s.efficiency}%` }} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="utility-grid">
        {u.throws.length > 0 && (
          <div className="table-wrap nade-log">
            <table className="table">
              <caption className="visually-hidden">{t("Grenade log")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("Round")}</th>
                  <th scope="col">{t("Grenade")}</th>
                  <th scope="col">{t("Where")}</th>
                  <th scope="col">{t("Result")}</th>
                  <th scope="col">
                    <span className="visually-hidden">{t("Clip")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {u.throws.slice(0, 40).map((g, i) => (
                  <tr key={i} className={g.verdict ? `nl-${g.verdict}` : ""}>
                    <td className="tabular">
                      {g.round ?? "–"}
                      {g.time !== null && (
                        <small className="muted"> {clock(g.time)}</small>
                      )}
                    </td>
                    <td>
                      <span className="nade-cell">
                        <NadeIcon type={g.type} size={16} />{" "}
                        {t(NADE_LABEL[g.type])}
                      </span>
                    </td>
                    <td>{g.place ? placeName(g.place) : "–"}</td>
                    <td>
                      {g.verdict && (
                        <span
                          className={`chip ${g.verdict === "good" ? "good" : "bad"}`}
                        >
                          {t(VERDICT[g.verdict]!)}
                        </span>
                      )}{" "}
                      {g.result ?? ""}
                    </td>
                    <td>
                      {g.clip && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={t("Watch clip")}
                          onClick={() =>
                            onPlay(
                              g.clip!,
                              `${t(NADE_LABEL[g.type])} · ${t("Round {n}", { n: g.round ?? g.clip!.round })}`,
                            )
                          }
                        >
                          <Play size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <NadePlot throws={u.throws} />
      </div>
      {u.lineups.length > 0 && (
        <>
          <h4 className="deep-sub">{t("Lineups to learn")}</h4>
          <ul className="lineups">
            {u.lineups.map((l, i) => (
              <li key={i} className="lineup">
                {l.type && <NadeIcon type={l.type} size={22} />}
                <span>
                  <strong>{lineupTitle(l, t)}</strong>
                  {lineupWhy(l, t, locale) && (
                    <span className="lineup-why">
                      {lineupWhy(l, t, locale)}
                    </span>
                  )}
                  {l.howTo && <span className="lineup-how">{l.howTo}</span>}
                </span>
                {l.clip && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => onPlay(l.clip!, lineupTitle(l, t))}
                  >
                    <Play size={16} /> {t("Watch")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
