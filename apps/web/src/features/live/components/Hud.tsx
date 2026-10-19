"use client";
import type { LiveState } from "@cs2/contracts";
import { finite, mapName, text } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Crosshair, Damage, Shield, Skull, Trophy } from "@/shared/icons";
import type { Badge } from "../model/connection";
import type { Baseline, CoachTip, RoundRecord } from "../model/liveCoach";

const PHASES: Record<string, string> = {
  live: "Live",
  warmup: "Warmup",
  freezetime: "Buy time",
  over: "Round over",
  gameover: "Game over",
  intermission: "Halftime",
};
const show = (v: unknown) => {
  const n = finite(v);
  return n !== null ? String(n) : (text(v) ?? "—");
};

export function Hud({
  state,
  badge,
  rounds,
  tips,
  baseline,
  feed,
  ai,
}: {
  state: LiveState | null;
  badge: Badge;
  rounds: RoundRecord[];
  tips: CoachTip[];
  baseline: Baseline | null;
  feed?: React.ReactNode;
  ai?: React.ReactNode;
}) {
  const { t, locale } = useI18n();
  const phase = text(state?.phase);
  const health = finite(state?.ownStats?.health);
  const armor = finite(state?.ownStats?.armor);
  const kills = finite(state?.ownStats?.kills);
  const deaths = finite(state?.ownStats?.deaths);
  const kd =
    kills !== null && deaths !== null
      ? deaths === 0
        ? kills
        : kills / deaths
      : null;
  const badgeLabel: Record<Badge, string> = {
    live: "LIVE · GSI",
    simulated: "SIMULATED · GSI pipeline",
    replay: "REPLAY · from demo",
    stale: "STALE · last known state",
    offline: "NO DATA",
  };
  return (
    <div className={`hud badge-${badge}`}>
      <div className="hud-top">
        <span className={`hud-badge ${badge}`}>
          <i aria-hidden="true" />
          {t(badgeLabel[badge])}
        </span>
        <h2 data-testid="map">{mapName(state?.map) ?? "—"}</h2>
        <div className="phase">
          <span>{t("Phase")}</span>
          <strong data-testid="phase">
            {phase ? t(PHASES[phase] ?? phase) : "—"}
          </strong>
        </div>
      </div>
      <div className="scoreboard">
        <div className="team ct">
          <span>CT</span>
          <strong data-testid="score-ct">{show(state?.score?.ct)}</strong>
        </div>
        <div className="round">
          <span>{t("Round")}</span>
          <strong data-testid="round">{show(state?.round)}</strong>
        </div>
        <div className="team t">
          <span>T</span>
          <strong data-testid="score-t">{show(state?.score?.t)}</strong>
        </div>
      </div>

      <div className="hud-grid">
        <section className="hud-vitals" aria-label={t("Your player")}>
          <div className="vital">
            <span>
              <Damage size={18} /> {t("Health")}
            </span>
            <strong data-testid="health">{show(health)}</strong>
            <div className="bar health">
              <i style={{ width: `${health ?? 0}%` }} />
            </div>
          </div>
          <div className="vital">
            <span>
              <Shield size={18} /> {t("Armor")}
            </span>
            <strong data-testid="armor">{show(armor)}</strong>
            <div className="bar armor">
              <i style={{ width: `${armor ?? 0}%` }} />
            </div>
          </div>
          <div className="kda">
            <div>
              <Crosshair size={18} />
              <strong data-testid="kills">{show(kills)}</strong>
              <span>{t("Kills")}</span>
            </div>
            <div>
              <Skull size={18} />
              <strong data-testid="deaths">{show(deaths)}</strong>
              <span>{t("Deaths")}</span>
            </div>
            <div>
              <Trophy size={18} />
              <strong data-testid="assists">
                {show(state?.ownStats?.assists)}
              </strong>
              <span>{t("Assists")}</span>
            </div>
          </div>
          <div className="baseline">
            <span>K/D</span>
            <strong>
              {kd === null
                ? "—"
                : kd.toLocaleString(locale, { maximumFractionDigits: 2 })}
            </strong>
            {baseline?.kd != null ? (
              <small
                className={
                  kd !== null && kd >= baseline.kd
                    ? "good"
                    : kd !== null
                      ? "bad"
                      : ""
                }
              >
                {t("Your baseline {kd} ({label})", {
                  kd: baseline.kd.toLocaleString(locale, {
                    maximumFractionDigits: 2,
                  }),
                  label: baseline.label,
                })}
              </small>
            ) : (
              <small>
                {t(
                  "Mark yourself in a demo (“This is me”) to compare with your baseline.",
                )}
              </small>
            )}
          </div>
        </section>

        <section className="hud-coach" aria-label={t("Live coach")}>
          <h3>
            <Trophy size={20} /> {t("Live coach")}
          </h3>
          <p className="muted small">
            {t(
              "Uses only your own data. Tips appear between rounds, never during a fight.",
            )}
          </p>
          {tips.length === 0 ? (
            <p className="muted">{t("Waiting for game data")}</p>
          ) : (
            <ul className="tips">
              {tips.map((tip) => (
                <li key={tip.id} className={tip.tone}>
                  {t(tip.text, tip.vars)}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {ai}
      <section className="timeline" aria-label={t("Round timeline")}>
        <h3>{t("Round timeline")}</h3>
        {rounds.length === 0 ? (
          <p className="muted small">
            {t("Rounds appear here as they finish.")}
          </p>
        ) : (
          <ol>
            {rounds.map((r) => (
              <li
                key={r.round}
                className={r.died ? "died" : "alive"}
                title={t("Round {n}: {k} kills", { n: r.round, k: r.kills })}
              >
                <span className="tl-round">{r.round}</span>
                <span className="tl-kills">
                  {r.kills > 0 ? `${r.kills}K` : "·"}
                </span>
                {r.died && <Skull size={12} />}
              </li>
            ))}
          </ol>
        )}
      </section>
      {feed}
    </div>
  );
}
