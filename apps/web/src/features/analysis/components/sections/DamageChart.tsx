"use client";
import { useI18n } from "@/shared/i18n";
import { Skull, Damage } from "@/shared/icons";
import { Panel } from "@/shared/ui";
import type { PlayerRound } from "../../model/types";
export function DamageChart({
  rows,
  onRound,
}: {
  rows: PlayerRound[];
  onRound: (round: number) => void;
}) {
  const { t } = useI18n();
  if (!rows.length) return null;
  const max = Math.max(100, ...rows.map((r) => r.damage));
  return (
    <Panel
      icon={<Damage size={20} />}
      title={t("Damage per round")}
      actions={
        <span className="chart-legend">
          <span>
            <i className="won" /> {t("Round won")}
          </span>
          <span>
            <i className="lost" /> {t("Round lost")}
          </span>
          <span>
            <Skull size={13} /> {t("Died")}
          </span>
        </span>
      }
    >
      <div className="dmg-chart" role="list">
        <span className="dmg-100" style={{ bottom: `${(100 / max) * 100}%` }}>
          100
        </span>
        {rows.map((r, i) => (
          <button
            type="button"
            role="listitem"
            key={r.round}
            className={`dmg-bar ${r.won === true ? "won" : r.won === false ? "lost" : ""}`}
            style={
              {
                "--h": `${Math.max(3, (r.damage / max) * 100)}%`,
                "--i": i,
              } as React.CSSProperties
            }
            title={t("Round {n}: {dmg} damage, {k} kills", {
              n: r.round,
              dmg: r.damage,
              k: r.kills,
            })}
            onClick={() => onRound(r.round)}
          >
            <span className="dmg-val">{r.damage}</span>
            <span className="dmg-fill" />
            <span className="dmg-meta">
              {r.kills > 0 && <b>{r.kills}K</b>}
              {r.died && <Skull size={11} />}
            </span>
            <span className="dmg-num">{r.round}</span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

/* --------------------------------------------------------------- rounds */
