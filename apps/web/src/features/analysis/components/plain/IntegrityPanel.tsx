"use client";
import { useI18n } from "@/shared/i18n";
import { ShieldAlert } from "@/shared/icons";
import { banText, reasonText, type Integrity } from "../../model/extras";

/**
 * Discreet "Match integrity" note, only when something stands out. Neutral words only: these
 * are statistical signals, never an accusation.
 */
export function IntegrityPanel({
  integrity,
  names,
}: {
  integrity: Integrity | null;
  names: Map<string, string>;
}) {
  const { t } = useI18n();
  if (!integrity || (!integrity.players.length && !integrity.bans.length))
    return null;
  const name = (id: string) => names.get(id) ?? t("A player");
  return (
    <section className="integrity" aria-labelledby="integrity-h">
      <h3 id="integrity-h">
        <ShieldAlert size={18} /> {t("Match integrity")}
      </h3>
      <ul>
        {integrity.players.map((p) => (
          <li key={p.steamId}>
            <strong>{name(p.steamId)}</strong>
            <span className="int-kind">{t("Statistically unusual aim")}</span>
            <ul>
              {p.reasons.map((r) => {
                const x = reasonText(r);
                return <li key={r.code}>{t(x.text, x.params)}</li>;
              })}
            </ul>
          </li>
        ))}
        {integrity.bans.map((b) => {
          const x = banText(b, null);
          return (
            <li key={`ban-${b.steamId}`}>
              <strong>{name(b.steamId)}</strong>
              <span className="int-kind">{t(x.text, x.params)}</span>
            </li>
          );
        })}
      </ul>
      <p className="muted small">
        {t(
          "This is a statistical signal, not proof. Deaths to these players aren't counted against you.",
        )}{" "}
        {t("Report in game via the scoreboard.")}
      </p>
    </section>
  );
}
