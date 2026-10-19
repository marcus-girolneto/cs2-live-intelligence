"use client";
import { useI18n } from "@/shared/i18n";
import {
  Bolt,
  Check,
  Film,
  Layers,
  Monitor,
  ShieldCheck,
} from "@/shared/icons";

/** The two modes side by side: post-match review (Quick / Deep) and the live AI IGL. */
export function TwoModes() {
  const { t } = useI18n();
  return (
    <section
      className="landing-section two-modes"
      aria-labelledby="modes-title"
    >
      <div className="ls-head">
        <span className="eyebrow">{t("Two modes")}</span>
        <h2 id="modes-title">{t("Review after. Lead during.")}</h2>
      </div>
      <div className="tm-grid">
        <article className="tm-card post">
          <header>
            <span className="tm-icon">
              <Film size={24} />
            </span>
            <div>
              <h3>{t("Post-match review")}</h3>
              <p className="small muted">
                {t("Upload a demo, get your AI Coach report.")}
              </p>
            </div>
          </header>
          <div className="tm-tiers">
            <div>
              <b>
                <Bolt size={14} /> {t("Quick")}
              </b>
              <span>
                {t("Verdict, scores, key moments as 2D replays and a plan.")}
              </span>
            </div>
            <div>
              <b>
                <Layers size={14} /> {t("Deep")}
              </b>
              <span>
                {t(
                  "Utility lab, crosshair placement, positioning and every round — with a stronger AI.",
                )}
              </span>
            </div>
          </div>
        </article>
        <article className="tm-card live">
          <header>
            <span className="tm-icon">
              <Monitor size={24} />
            </span>
            <div>
              <h3>{t("Live AI IGL on your second screen")}</h3>
              <p className="small muted">
                {t("Between rounds, the AI acts as your in-game leader.")}
              </p>
            </div>
          </header>
          <ul className="tm-list">
            <li>
              <Check size={14} />{" "}
              {t("One call per round, from your own live game state.")}
            </li>
            <li>
              <ShieldCheck size={14} />{" "}
              {t("Never during the fight. Never hidden information.")}
            </li>
            <li>
              <Check size={14} />{" "}
              {t("Phone or second monitor — nothing runs inside the game.")}
            </li>
          </ul>
        </article>
      </div>
    </section>
  );
}
