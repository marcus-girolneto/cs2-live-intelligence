import { weaponClass, weaponName } from "@/shared/format";
import {
  Eye,
  Headshot,
  Scope,
  Skull,
  Smoke,
  WeaponIcon,
  Wallbang,
} from "@/shared/icons";
import type { KillRow } from "../model/types";
export function KillFeed({
  rows,
  names,
  highlight,
  world,
}: {
  rows: KillRow[];
  names: Map<string, string>;
  highlight?: string;
  world: string;
}) {
  const side = (s?: string) => (s === "CT" ? "ct" : s === "T" ? "t" : "none");
  return (
    <ul className="killfeed">
      {rows.map((k) => {
        const mine =
          highlight && (k.attacker === highlight || k.victim === highlight)
            ? k.attacker === highlight
              ? "mine kill"
              : "mine death"
            : "";
        const label = weaponName(k.weapon);
        return (
          <li key={k.id} className={mine}>
            {k.time !== undefined && Number.isFinite(k.time) && (
              <span className="kf-time">
                {Math.floor(k.time / 60)}:
                {String(Math.floor(k.time % 60)).padStart(2, "0")}
              </span>
            )}
            <span className={`kf-name ${side(k.attackerSide)}`}>
              {k.attacker ? (names.get(k.attacker) ?? k.attacker) : world}
            </span>
            {k.attackerBlind && (
              <span className="kf-flag" title="blind">
                <Eye size={14} />
              </span>
            )}
            <span className="kf-weapon" title={label ?? undefined}>
              {k.weapon ? (
                <WeaponIcon cls={weaponClass(k.weapon)} size={14} />
              ) : (
                <Skull size={15} />
              )}
              {label && <span className="kf-wname">{label}</span>}
            </span>
            {k.noScope && (
              <span className="kf-flag" title="no-scope">
                <Scope size={14} />
              </span>
            )}
            {k.throughSmoke && (
              <span className="kf-flag" title="through smoke">
                <Smoke size={14} />
              </span>
            )}
            {k.penetrated && (
              <span className="kf-flag" title="wallbang">
                <Wallbang size={14} />
              </span>
            )}
            {k.headshot && (
              <span className="kf-flag hs" aria-label="headshot">
                <Headshot size={15} />
              </span>
            )}
            <span className={`kf-name ${side(k.victimSide)}`}>
              {names.get(k.victim) ?? k.victim}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
