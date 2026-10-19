"use client";
import { useI18n } from "@/shared/i18n";
import { ArrowRight, Skull, Target, Trophy } from "@/shared/icons";
import { AFTER_SCORES, BEFORE_SCORES, LOSS_FEED } from "../model/showcase";

/** "Lost again. No idea why." — a kill-feed of repeated mistakes turning into a plan. */
export function FrustrationBoard() {
  const { t } = useI18n();
  return (
    <section
      className="landing-section frustration"
      aria-labelledby="pain2-title"
    >
      <div className="ls-head">
        <span className="eyebrow">{t("Sound familiar?")}</span>
        <h2 id="pain2-title">{t("Lost again. No idea why.")}</h2>
        <p className="lead">
          {t(
            "Same deaths, same spots, match after match. The scoreboard tells you that you lost — not why.",
          )}
        </p>
      </div>
      <div className="fb-board">
        <div className="fb-col before">
          <h3>
            <Skull size={18} /> {t("Before")}
          </h3>
          <ul className="fb-feed" aria-label={t("Your kill feed")}>
            {LOSS_FEED.map((l) => (
              <li key={l.text}>
                <span className="fb-you">{t("You")}</span>
                <Skull size={14} />
                <span>{t(l.text)}</span>
                <em>{t(l.tag)}</em>
              </li>
            ))}
          </ul>
          <ol className="fb-scores" aria-label={t("Last matches")}>
            {BEFORE_SCORES.map((s, i) => (
              <li key={i} className="loss">
                <b>L</b> {s}
              </li>
            ))}
          </ol>
        </div>
        <div className="fb-arrow" aria-hidden>
          <span>{t("The plan")}</span>
          <ArrowRight size={28} />
        </div>
        <div className="fb-col after">
          <h3>
            <Trophy size={18} /> {t("After the plan")}
          </h3>
          <ul className="fb-plan">
            <li>
              <Target size={14} /> {t("Trade within 2 seconds on every entry.")}
            </li>
            <li>
              <Target size={14} /> {t("Call your flash before you throw it.")}
            </li>
            <li>
              <Target size={14} />{" "}
              {t("Pre-aim head height in Connector and Palace.")}
            </li>
          </ul>
          <ol className="fb-scores" aria-label={t("Next matches")}>
            {AFTER_SCORES.map((s, i) => (
              <li key={i} className={s.startsWith("13") ? "win" : "loss"}>
                <b>{s.startsWith("13") ? "W" : "L"}</b> {s}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <p className="fb-note small muted">
        {t(
          "Illustration. Results depend on you — the coach shows you where to start.",
        )}
      </p>
    </section>
  );
}
