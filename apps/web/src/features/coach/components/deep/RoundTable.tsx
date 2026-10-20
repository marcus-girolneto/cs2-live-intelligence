"use client";
import { useI18n } from "@/shared/i18n";
import { formatNumber } from "@/shared/format";
import { Play, Skull } from "@/shared/icons";
import { SideTag } from "@/shared/ui";
import type { ClipRef } from "../../model/coaching";
import type { RoundRow } from "../../model/deep";

/** Deep: one row per round — side, result, buy, kills, damage, tags and a clip. */
export function RoundTable({
  rounds,
  onPlay,
}: {
  rounds: RoundRow[];
  onPlay: (clip: ClipRef, title: string) => void;
}) {
  const { t, locale } = useI18n();
  return (
    <div className="table-wrap round-table">
      <table className="table">
        <caption className="visually-hidden">
          {t("Round-by-round table")}
        </caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">{t("Side")}</th>
            <th scope="col">{t("Result")}</th>
            <th scope="col">{t("Buy")}</th>
            <th scope="col" className="r">
              {t("Kills")}
            </th>
            <th scope="col" className="r">
              {t("Damage")}
            </th>
            <th scope="col">{t("What happened")}</th>
            <th scope="col">
              <span className="visually-hidden">{t("Clip")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rounds.map((r) => (
            <tr
              key={r.round}
              className={r.won === false ? "lost" : r.won ? "won" : ""}
            >
              <th scope="row" className="tabular">
                {r.round}
              </th>
              <td>{r.side ? <SideTag side={r.side} /> : "–"}</td>
              <td>
                {r.won === null ? (
                  "–"
                ) : (
                  <span className={`chip ${r.won ? "good" : "bad"}`}>
                    {r.won ? t("Won") : t("Lost")}
                  </span>
                )}
              </td>
              <td>{r.buy ?? "–"}</td>
              <td className="r tabular">
                {formatNumber(r.kills, 0, locale) ?? "–"}
                {r.died && (
                  <Skull size={14} className="rt-died" title={t("Died")} />
                )}
              </td>
              <td className="r tabular">
                {formatNumber(r.damage, 0, locale) ?? "–"}
              </td>
              <td>
                <span className="rt-tags">
                  {r.tags.map((tag) => (
                    <span key={tag} className="chip">
                      {tag}
                    </span>
                  ))}
                </span>
                {r.note && <span className="rt-note">{r.note}</span>}
              </td>
              <td>
                {r.clip && (
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`${t("Watch clip")}: ${t("Round {n}", { n: r.round })}`}
                    onClick={() =>
                      onPlay(r.clip!, t("Round {n}", { n: r.round }))
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
  );
}
