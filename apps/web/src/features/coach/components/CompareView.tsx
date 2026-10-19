"use client";
import { useI18n } from "@/shared/i18n";
import { Bolt, Check, Layers, Sparkle } from "@/shared/icons";
import type { CoachReview } from "../model/coaching";
import { compareReviews } from "../model/compare";
import { LABELS as SCORE_LABELS } from "./ScoreRadar";

/** Quick vs Deep side by side: verdicts, scores, counts and what Deep revealed on top. */
export function CompareView({
  quick,
  deep,
  onOpen,
}: {
  quick: CoachReview;
  deep: CoachReview;
  onOpen: (tier: "quick" | "deep") => void;
}) {
  const { t } = useI18n();
  const c = compareReviews(quick, deep);
  const cols = [
    { tier: "quick" as const, r: quick, Icon: Bolt, name: t("Quick review") },
    { tier: "deep" as const, r: deep, Icon: Layers, name: t("Deep review") },
  ];
  return (
    <section
      className="compare-view"
      aria-label={t("Quick vs Deep")}
      data-testid="compare-view"
    >
      <div className="cmp-cols">
        {cols.map(({ tier, r, Icon, name }) => (
          <article key={tier} className={`cmp-col ${tier}`}>
            <header>
              <span className="cmp-tier">
                <Icon size={18} /> {name}
              </span>
              {c.overall[tier] !== null && (
                <span
                  className="cmp-overall"
                  aria-label={t("Overall score {n} of 100", {
                    n: c.overall[tier]!,
                  })}
                >
                  <b className="tabular">{c.overall[tier]}</b>
                  <small>{t("Overall")}</small>
                </span>
              )}
            </header>
            <h3 className="cmp-verdict">
              {r.verdict ?? t("Your match, reviewed")}
            </h3>
            {r.summary && <p className="muted small">{r.summary}</p>}
            <dl className="cmp-counts">
              <div>
                <dt>{t("Priorities")}</dt>
                <dd className="tabular">{c.insights[tier]}</dd>
              </div>
              <div>
                <dt>{t("Key moments")}</dt>
                <dd className="tabular">{c.moments[tier]}</dd>
              </div>
            </dl>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onOpen(tier)}
            >
              {t("Open full review")}
            </button>
          </article>
        ))}
      </div>
      {c.scores.length > 0 && (
        <div className="cmp-scores" role="table" aria-label={t("Scores")}>
          <div role="row" className="cmp-score-head">
            <span role="columnheader">{t("Score")}</span>
            <span role="columnheader">{t("Quick")}</span>
            <span role="columnheader">{t("Deep")}</span>
          </div>
          {c.scores.map((s) => (
            <div role="row" key={s.key} className="cmp-score">
              <span role="rowheader">{t(SCORE_LABELS[s.key])}</span>
              {(["quick", "deep"] as const).map((tier) => (
                <span role="cell" key={tier} className={`cmp-bar ${tier}`}>
                  <i style={{ width: `${s[tier] ?? 0}%` }} />
                  <b className="tabular">{s[tier] ?? "—"}</b>
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
      {c.extras.length > 0 && (
        <div className="cmp-extras">
          <h3 className="sec-title">
            <Sparkle size={20} /> {t("What the Deep review revealed")}
          </h3>
          <ul>
            {c.extras.map((x) => (
              <li key={x.key}>
                <Check size={16} /> {t(x.label, { n: x.n })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
