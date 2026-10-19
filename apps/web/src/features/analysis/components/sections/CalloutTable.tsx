"use client";
import { placeName } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { useNum } from "../../hooks/useNum";
import type { PlaceRow } from "../../model/insight/index";
export function CalloutTable({ rows }: { rows: PlaceRow[] }) {
  const { t } = useI18n();
  const num = useNum();
  if (!rows.length) return null;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.kills, r.deaths)));
  return (
    <ul className="callouts">
      {rows.map((r) => {
        const diff = r.kills - r.deaths;
        return (
          <li
            key={r.place}
            className={diff > 0 ? "win" : diff < 0 ? "lose" : ""}
          >
            <span className="co-name" title={placeName(r.place) ?? undefined}>
              {placeName(r.place)}
            </span>
            <span className="co-bars" aria-hidden>
              <span className="co-d">
                <i style={{ width: `${(r.deaths / max) * 100}%` }} />
              </span>
              <span className="co-k">
                <i style={{ width: `${(r.kills / max) * 100}%` }} />
              </span>
            </span>
            <span className="co-kd">
              <b className="k">{r.kills}</b>
              <span>–</span>
              <b className="d">{r.deaths}</b>
            </span>
            <span className="co-dmg">
              {r.damage > 0 ? t("{n} dmg", { n: num(r.damage)! }) : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* --------------------------------------------------------------- timing */
