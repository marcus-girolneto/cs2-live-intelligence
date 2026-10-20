"use client";
import { useI18n } from "@/shared/i18n";
import { Film, Radar, Target, Trophy, Users } from "@/shared/icons";
import type { ClipRef } from "../../model/coaching";
import { ROLE_LABEL, type StoredTeamReview } from "../../model/team";
import { TeamRadar } from "./TeamRadar";

/** The team review: verdict, team scores, a card per player, key rounds and the team plan. */
export function TeamReport({
  stored,
  nameOf,
  onPlay,
  onBack,
}: {
  stored: StoredTeamReview;
  nameOf: (steamId: string) => string;
  onPlay: (clip: ClipRef, title: string) => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const r = stored.review;
  const owner = (o: string) => (o === "team" ? t("Whole team") : nameOf(o));
  return (
    <article className="report team-report" data-testid="team-report">
      <header className="verdict">
        <div className="verdict-text">
          <span className="eyebrow">
            <span className="tier-tag team">{t("Team review")}</span>
          </span>
          <h2>{r.verdict ?? t("Your team, reviewed")}</h2>
          <button type="button" className="btn-link" onClick={onBack}>
            {t("Back to my review")}
          </button>
        </div>
      </header>

      {r.plan.length > 0 && (
        <section className="report-sec">
          <h3 className="sec-title">
            <Target size={20} /> {t("Team plan for the next match")}
          </h3>
          <ol className="team-plan">
            {r.plan.map((p) => (
              <li key={p.text}>
                <span className="tp-owner">{owner(p.owner)}</span>
                <span>{p.text}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {r.scores.length >= 3 && (
        <section className="report-sec">
          <h3 className="sec-title">
            <Radar size={20} /> {t("Team scores vs the enemy team")}
          </h3>
          <TeamRadar scores={r.scores} />
        </section>
      )}

      {r.roles.length > 0 && (
        <section className="report-sec">
          <h3 className="sec-title">
            <Users size={20} /> {t("Every player's role")}
          </h3>
          <div className="team-players">
            {r.roles.map((p) => (
              <article key={p.steamId} className="team-player">
                <header>
                  <strong>{nameOf(p.steamId)}</strong>
                  <span className="chip">
                    {t(ROLE_LABEL[p.role] ?? p.role)}
                  </span>
                </header>
                {p.strengths.length > 0 && (
                  <>
                    <h4>
                      <Trophy size={14} /> {t("Strengths")}
                    </h4>
                    <ul>
                      {p.strengths.map((s) => (
                        <li key={s.text}>{s.text}</li>
                      ))}
                    </ul>
                  </>
                )}
                {p.fixes.length > 0 && (
                  <>
                    <h4 className="fix">
                      <Target size={14} /> {t("To fix")}
                    </h4>
                    <ul>
                      {p.fixes.map((s) => (
                        <li key={s.text}>{s.text}</li>
                      ))}
                    </ul>
                  </>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {r.keyRounds.length > 0 && (
        <section className="report-sec">
          <h3 className="sec-title">
            <Film size={20} /> {t("Key rounds")}
          </h3>
          <ol className="fix-list">
            {r.keyRounds.map((k) => (
              <li key={`${k.round}-${k.title}`} className="fix-card">
                <span className="fix-n" aria-hidden>
                  {k.round}
                </span>
                <div className="fix-body">
                  <h4>
                    {t("Round {n}: {title}", { n: k.round, title: k.title })}
                  </h4>
                  <dl className="fix-steps">
                    {k.whatHappened && (
                      <div>
                        <dt>{t("What happened")}</dt>
                        <dd>{k.whatHappened}</dd>
                      </div>
                    )}
                    {k.whatToDoInstead && (
                      <div className="todo">
                        <dt>{t("What to do instead")}</dt>
                        <dd>{k.whatToDoInstead}</dd>
                      </div>
                    )}
                  </dl>
                  {k.clip && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => onPlay(k.clip!, k.title)}
                    >
                      <Film size={16} /> {t("Watch clip")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {r.patterns.length > 0 && (
        <section className="report-sec">
          <h3 className="sec-title">
            <Target size={20} /> {t("Team patterns")}
          </h3>
          <ul className="strength-list">
            {r.patterns.map((p) => (
              <li key={p.text}>
                {p.text}
                {p.confidence && (
                  <span
                    className={`conf-tag ${p.confidence === "high" ? "clear" : "early"}`}
                  >
                    {p.confidence === "high"
                      ? t("Clear pattern")
                      : t("Early sign")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.caveats.length > 0 && (
        <details className="more">
          <summary>{t("Limits of this review")}</summary>
          <ul className="caveats">
            {r.caveats.map((x) => (
              <li key={x}>{t(x)}</li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
