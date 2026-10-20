"use client";
import { formatNumber } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import type { AnalysisVM } from "../hooks/useAnalysisView";
import { metricValue } from "../model/players";
/** Player list grouped by starting side (a select on small screens). */
export function PlayerPicker({ vm }: { vm: AnalysisVM }) {
  const { t, locale } = useI18n();
  const num = (v: unknown, d = 0) => formatNumber(v, d, locale);
  const {
    names,
    players,
    player,
    teams,
    unknownTeam,
    me,
    resultId,
    accountSteamId,
    setSelectedId,
    setFocusRounds,
  } = vm;
  const pickPlayer = (id: string) => {
    setSelectedId(id);
    setFocusRounds([]);
  };
  const playerButton = (p: (typeof players)[number]) => {
    const pk = metricValue(p, "kills");
    const pd = metricValue(p, "deaths");
    const you =
      (me?.analysisId === resultId && me.steamId === p.steamId) ||
      accountSteamId === p.steamId;
    return (
      <li key={p.steamId}>
        <button
          type="button"
          aria-pressed={p.steamId === player.steamId}
          onClick={() => pickPlayer(p.steamId)}
          className={`pp-row ${p.start?.toLowerCase() ?? ""}`}
        >
          <span className="pp-name">
            {names.get(p.steamId)}
            {you && <small className="you-badge">{t("You")}</small>}
          </span>
          <span className="pp-kd">
            {pk !== null && pd !== null ? `${num(pk)}–${num(pd)}` : "–"}
          </span>
          <span className="pp-adr">{num(metricValue(p, "adr")) ?? "–"}</span>
        </button>
      </li>
    );
  };
  return (
    <aside className="player-picker" aria-label={t("Pick a player")}>
      <div className="pp-head">
        <span>{t("Player")}</span>
        <span>{t("K–D")}</span>
        <span>ADR</span>
      </div>
      {teams.map(
        ({ side, list }) =>
          list.length > 0 && (
            <div key={side} className={`pp-team ${side.toLowerCase()}`}>
              <span className="pp-team-label">
                {t("Started {side}", { side })}
              </span>
              <ul>{list.map(playerButton)}</ul>
            </div>
          ),
      )}
      {unknownTeam.length > 0 && (
        <div className="pp-team">
          <ul>{unknownTeam.map(playerButton)}</ul>
        </div>
      )}
      <label className="pp-select">
        {t("Pick a player")}
        <select
          value={player.steamId}
          onChange={(e) => pickPlayer(e.target.value)}
        >
          {players.map((p) => (
            <option key={p.steamId} value={p.steamId}>
              {names.get(p.steamId)} · {num(metricValue(p, "adr")) ?? "–"} ADR
            </option>
          ))}
        </select>
      </label>
    </aside>
  );
}
