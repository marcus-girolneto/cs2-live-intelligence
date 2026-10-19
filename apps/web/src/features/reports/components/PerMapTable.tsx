"use client";
import { MapBadge } from "@/features/maps";
import { formatNumber, mapName } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import type { MapRow } from "../model/report";

/** Per-map form for the month (win-rate bar, ADR, K/D). */
export function PerMapTable({ rows }: { rows: MapRow[] }) {
  const { t, locale } = useI18n();
  const f = (v: number | null, d = 0) => formatNumber(v, d, locale) ?? "—";
  return (
    <div className="table-wrap">
      <table className="table permap">
        <caption className="visually-hidden">{t("Per map")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("Map")}</th>
            <th scope="col" className="r">
              {t("Matches")}
            </th>
            <th scope="col">{t("Win rate")}</th>
            <th scope="col" className="r">
              ADR
            </th>
            <th scope="col" className="r">
              K/D
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.map}>
              <th scope="row">
                <span className="pm-map">
                  <MapBadge map={r.map} size={24} label={false} />
                  {mapName(r.map) ?? r.map}
                </span>
              </th>
              <td className="r tabular">{f(r.matches)}</td>
              <td>
                {r.winRate === null ? (
                  "—"
                ) : (
                  <span className="pm-win">
                    <span className="meter-mini" aria-hidden>
                      <i style={{ width: `${r.winRate}%` }} />
                    </span>
                    <span className="tabular">{f(r.winRate)}%</span>
                  </span>
                )}
              </td>
              <td className="r tabular">{f(r.adr, 1)}</td>
              <td className="r tabular">{f(r.kd, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
