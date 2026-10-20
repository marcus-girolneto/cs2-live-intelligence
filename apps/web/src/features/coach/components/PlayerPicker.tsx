"use client";
import { useI18n } from "@/shared/i18n";
import { formatNumber } from "@/shared/format";
import { Check } from "@/shared/icons";
import { Avatar, SideTag } from "@/shared/ui";
import type { RosterEntry } from "../model/session";

/** Step 2: the roster of the match; "You" is preselected when known. */
export function PlayerPicker({
  roster,
  selected,
  onPick,
}: {
  roster: RosterEntry[];
  selected: string | null;
  onPick: (steamId: string) => void;
}) {
  const { t, locale } = useI18n();
  const teams: ("CT" | "T" | null)[] = ["CT", "T", null];
  return (
    <div className="roster">
      {teams.map((team) => {
        const list = roster.filter((r) => r.team === team);
        if (!list.length) return null;
        return (
          <section
            key={team ?? "x"}
            className={`roster-team ${team?.toLowerCase() ?? ""}`}
          >
            <h3>
              <SideTag side={team} />{" "}
              {team === "CT"
                ? t("Started as CT")
                : team === "T"
                  ? t("Started as T")
                  : t("Players")}
            </h3>
            <ul>
              {list.map((p) => (
                <li key={p.steamId}>
                  <button
                    type="button"
                    className="roster-card"
                    aria-pressed={selected === p.steamId}
                    onClick={() => onPick(p.steamId)}
                  >
                    <Avatar size={40} ring={false} fallback={p.name} />
                    <span className="rc-name">
                      <strong>{p.name}</strong>
                      {p.isYou && (
                        <span className="chip accent">{t("You")}</span>
                      )}
                    </span>
                    <span className="rc-stats">
                      {p.kills !== null && p.deaths !== null
                        ? `${formatNumber(p.kills, 0, locale)}–${formatNumber(p.deaths, 0, locale)}`
                        : "–"}
                      <small>
                        {p.adr !== null
                          ? `${formatNumber(p.adr, 0, locale)} ADR`
                          : ""}
                      </small>
                    </span>
                    {selected === p.steamId && (
                      <Check size={18} className="rc-check" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
