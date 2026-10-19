"use client";
import { formatNumber } from "@/shared/format";
import { Term, type GlossaryId } from "@/shared/glossary";
import { useI18n } from "@/shared/i18n";
import { compareToLobby, type Verdict } from "../../model/plain";

export type KeyStat = {
  id: string;
  term: GlossaryId;
  label: string;
  value: number | null;
  lobby: number | null;
  digits: number;
  unit: "" | "%";
  explain: string;
};

const VERDICT: Record<Verdict, string> = {
  above: "Above average",
  about: "About average",
  below: "Below average",
};

/** The 3–4 numbers that matter, big, each with a verdict vs the lobby and one line of why. */
export function KeyStats({ stats }: { stats: KeyStat[] }) {
  const { t, locale } = useI18n();
  const fmt = (v: number, d: number, u: string) =>
    `${formatNumber(v, d, locale) ?? "—"}${u}`;
  return (
    <div className="key-stats">
      {stats.map((s) => {
        const v = compareToLobby(s.value, s.lobby);
        return (
          <div key={s.id} className={`key-stat ${v ?? ""}`}>
            <span className="ks-label">
              <Term id={s.term}>{t(s.label)}</Term>
            </span>
            <strong className="ks-value">
              {s.value === null ? t("No data") : fmt(s.value, s.digits, s.unit)}
            </strong>
            {v && <span className={`ks-verdict ${v}`}>{t(VERDICT[v])}</span>}
            {s.lobby !== null && (
              <small className="ks-lobby">
                {t("Lobby average: {v}", {
                  v: fmt(s.lobby, s.digits, s.unit),
                })}
              </small>
            )}
            <span className="ks-explain">{t(s.explain)}</span>
          </div>
        );
      })}
    </div>
  );
}
