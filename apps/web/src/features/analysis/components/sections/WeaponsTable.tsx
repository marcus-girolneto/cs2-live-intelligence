"use client";
import { useI18n } from "@/shared/i18n";
import { WeaponIcon } from "@/shared/icons";
import { Meter } from "@/shared/ui";
import { useNum } from "../../hooks/useNum";
import type { WeaponRow } from "../../model/insight/index";
export function WeaponsTable({ rows }: { rows: WeaponRow[] }) {
  const { t } = useI18n();
  const num = useNum();
  const guns = rows.filter((w) => w.cls !== "grenade");
  if (!guns.length)
    return <p className="muted small">{t("No weapon data in this demo.")}</p>;
  const maxKills = Math.max(1, ...guns.map((w) => w.kills));
  return (
    <div className="table-wrap">
      <table className="table weapons-table">
        <thead>
          <tr>
            <th>{t("Weapon")}</th>
            <th className="r">{t("Kills")}</th>
            <th className="r">{t("HS%")}</th>
            <th>{t("Accuracy")}</th>
            <th className="r">{t("Damage")}</th>
            <th className="r">{t("Shots")}</th>
          </tr>
        </thead>
        <tbody>
          {guns.map((w) => (
            <tr key={w.weapon}>
              <th scope="row">
                <span className="wpn">
                  <span className="wpn-icon">
                    <WeaponIcon cls={w.cls} size={16} />
                  </span>
                  {w.name}
                </span>
              </th>
              <td className="r">
                <span className="kills-cell">
                  <Meter value={w.kills} max={maxKills} />
                  <b>{w.kills}</b>
                </span>
              </td>
              <td className="r">
                {w.hsRate === null ? "–" : `${num(w.hsRate)}%`}
              </td>
              <td>
                {w.accuracy === null ? (
                  <span className="muted">–</span>
                ) : (
                  <span className="acc-cell">
                    <Meter
                      value={w.accuracy}
                      tone={
                        w.accuracy >= 30
                          ? "good"
                          : w.accuracy >= 18
                            ? "accent"
                            : "bad"
                      }
                    />
                    <b>{num(w.accuracy)}%</b>
                  </span>
                )}
              </td>
              <td className="r">{num(w.damage)}</td>
              <td className="r muted">
                {w.shots === null ? "–" : `${num(w.hits)}/${num(w.shots)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------- callouts */
