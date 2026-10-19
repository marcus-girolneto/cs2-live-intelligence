"use client";
import { useI18n } from "@/shared/i18n";
import { Film, Target, Trophy } from "@/shared/icons";
import type { ClipRef, CoachReview } from "../model/coaching";
import { strengthsOf, topFixes, type Fix } from "../model/fixes";

/** "Top 3 fixes" (what happened → why it matters → what to do) and what went well. */
export function TopFixes({
  coaching,
  onPlay,
}: {
  coaching: CoachReview;
  onPlay: (clip: ClipRef, title: string) => void;
}) {
  const { t } = useI18n();
  const fixes = topFixes(coaching);
  const strengths = strengthsOf(coaching);
  if (!fixes.length && !strengths.length) return null;
  return (
    <>
      {fixes.length > 0 && (
        <section className="report-sec top-fixes" aria-labelledby="fixes-h">
          <h3 className="sec-title" id="fixes-h">
            <Target size={20} />{" "}
            {t(fixes.length === 1 ? "Your top fix" : "Your top {n} fixes", {
              n: fixes.length,
            })}
          </h3>
          <ol className="fix-list">
            {fixes.map((f, i) => (
              <FixCard key={i} n={i + 1} fix={f} onPlay={onPlay} />
            ))}
          </ol>
        </section>
      )}
      {strengths.length > 0 && (
        <section className="report-sec strengths" aria-labelledby="str-h">
          <h3 className="sec-title" id="str-h">
            <Trophy size={20} /> {t("What went well")}
          </h3>
          <ul className="strength-list">
            {strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function FixCard({
  n,
  fix,
  onPlay,
}: {
  n: number;
  fix: Fix;
  onPlay: (clip: ClipRef, title: string) => void;
}) {
  const { t } = useI18n();
  return (
    <li className="fix-card">
      <span className="fix-n" aria-hidden>
        {n}
      </span>
      <div className="fix-body">
        <h4>
          {fix.title}
          {fix.confidence && (
            <span className={`conf-tag ${fix.confidence}`}>
              {fix.confidence === "clear"
                ? t("Clear pattern")
                : t("Early sign")}
            </span>
          )}
        </h4>
        <dl className="fix-steps">
          {fix.happened && (
            <div>
              <dt>
                {fix.round !== null
                  ? t("What happened (round {n})", { n: fix.round })
                  : t("What happened")}
              </dt>
              <dd>{fix.happened}</dd>
            </div>
          )}
          {fix.why && (
            <div>
              <dt>{t("Why it matters")}</dt>
              <dd>{fix.why}</dd>
            </div>
          )}
          {fix.todo && (
            <div className="todo">
              <dt>{t("Next match, do this")}</dt>
              <dd>{fix.todo}</dd>
            </div>
          )}
        </dl>
        {fix.clip && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onPlay(fix.clip!, fix.title)}
          >
            <Film size={16} /> {t("Watch clip")}
          </button>
        )}
      </div>
    </li>
  );
}
