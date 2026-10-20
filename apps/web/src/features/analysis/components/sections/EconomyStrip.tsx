"use client";
import { useI18n } from "@/shared/i18n";
import { Kevlar, Money, Skull, WeaponIcon } from "@/shared/icons";
import type { PlayerRound } from "../../model/types";
export const BUY_ICON: Record<string, React.ReactNode> = {
  pistol: <WeaponIcon cls="pistol" size={12} />,
  eco: <Money size={14} />,
  force: <Kevlar size={14} />,
  full: <WeaponIcon cls="rifle" size={12} />,
};
export function EconomyStrip({
  rows,
  selected,
  onRound,
}: {
  rows: PlayerRound[];
  selected: number[];
  onRound: (round: number) => void;
}) {
  const { t, locale } = useI18n();
  if (!rows.length) return null;
  return (
    <div className="econ-strip" role="list" aria-label={t("Round by round")}>
      {rows.map((r) => (
        <button
          type="button"
          role="listitem"
          key={r.round}
          className={`es-round ${r.won === true ? "won" : r.won === false ? "lost" : ""} ${selected.includes(r.round) ? "on" : ""} ${r.side?.toLowerCase() ?? ""}`}
          onClick={() => onRound(r.round)}
          aria-pressed={selected.includes(r.round)}
          title={t("Round {n}", { n: r.round })}
        >
          <span className="es-n">{r.round}</span>
          <span className={`es-buy buy-${r.buyType ?? "none"}`}>
            {r.buyType ? BUY_ICON[r.buyType] : null}
          </span>
          <span className="es-val">
            {r.equipmentValue !== undefined
              ? `$${(r.equipmentValue / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })}k`
              : "–"}
          </span>
          <span className="es-k">
            {Array.from({ length: Math.min(5, r.kills) }, (_, i) => (
              <i key={i} />
            ))}
          </span>
          {r.died ? (
            <Skull size={12} className="es-died" />
          ) : (
            <span className="es-alive" />
          )}
        </button>
      ))}
    </div>
  );
}
