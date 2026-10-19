"use client";
import { useState } from "react";
import { BRAND } from "@/shared/brand";
import { useI18n } from "@/shared/i18n";
import { Brain, Target } from "@/shared/icons";
import { MISTAKES, type MistakeId } from "../model/showcase";

/** "Try it": pick a classic mistake, see what the coach says and the real stat behind it. */
export function TryIt() {
  const { t } = useI18n();
  const [pick, setPick] = useState<MistakeId>("alone");
  const m = MISTAKES.find((x) => x.id === pick) ?? MISTAKES[0];
  return (
    <section className="landing-section try-it" aria-labelledby="try-title">
      <div className="ls-head">
        <span className="eyebrow">{t("Try it")}</span>
        <h2 id="try-title">{t("Pick a mistake. See what the coach says.")}</h2>
        <p className="lead">
          {t(
            "Real numbers from the public sample match — the same analysis you get for your own demos.",
          )}
        </p>
      </div>
      <div className="try-grid">
        <div className="try-picks" role="radiogroup" aria-label={t("Mistakes")}>
          {MISTAKES.map(({ id, icon: Icon, title }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={pick === id}
              className={`try-pick ${pick === id ? "on" : ""}`}
              onClick={() => setPick(id)}
            >
              <Icon size={20} /> {t(title)}
            </button>
          ))}
        </div>
        <article className="try-answer" aria-live="polite" key={m.id}>
          <div className="try-stat">
            <b>{m.stat}</b>
            <span>{t(m.statLabel)}</span>
          </div>
          <p className="try-coach-head">
            <Brain size={16} /> {BRAND.coach}
          </p>
          <p className="try-coach">“{t(m.coach)}”</p>
          <p className="try-fix">
            <Target size={14} /> {t(m.fix)}
          </p>
        </article>
      </div>
    </section>
  );
}
