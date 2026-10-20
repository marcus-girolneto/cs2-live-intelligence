"use client";
import { formatNumber } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Users } from "@/shared/icons";
import type { LobbyMetric } from "../../model/extras";

/** "You vs the lobby": where you rank (1 = best) on each metric, as a simple bar. */
export function LobbyRanks({ metrics }: { metrics: LobbyMetric[] }) {
  const { t, locale } = useI18n();
  if (!metrics.length) return null;
  const fmt = (v: number | null, unit: string) =>
    v === null
      ? "—"
      : `${formatNumber(v, Math.abs(v) < 10 && unit !== "%" ? 2 : 0, locale)}${unit}`;
  return (
    <section className="lobby-ranks" aria-labelledby="lobby-h">
      <h3 id="lobby-h">
        <Users size={18} /> {t("You vs the lobby")}
      </h3>
      <p className="muted small">
        {t("Your place among the {n} players of this match (1 = best).", {
          n: metrics[0]!.players,
        })}
      </p>
      <ul>
        {metrics.map((m) => {
          const share = (m.players - m.rank + 1) / m.players;
          const tone =
            m.rank <= 3 ? "good" : m.rank > m.players - 3 ? "bad" : "mid";
          return (
            <li key={m.key} className={tone}>
              <span className="lr-label">{t(m.label)}</span>
              <span className="lr-rank">
                {t("#{r} of {n}", { r: m.rank, n: m.players })}
              </span>
              <span className="lr-bar" aria-hidden>
                <i style={{ width: `${Math.round(share * 100)}%` }} />
              </span>
              <span className="lr-vals">
                {t("You {v} · lobby {m} · best {b}", {
                  v: fmt(m.value, m.unit),
                  m: fmt(m.lobbyMedian, m.unit),
                  b: fmt(m.best, m.unit),
                })}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
