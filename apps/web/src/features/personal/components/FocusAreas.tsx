"use client";
import { formatNumber } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { ArrowRight, Target } from "@/shared/icons";
import type { FocusArea } from "../model/personal";

/** Focus areas: why it matters and a current → target bar. */
export function FocusAreas({ areas }: { areas: FocusArea[] }) {
  const { t, locale } = useI18n();
  if (!areas.length) return null;
  const n = (v: number | null) =>
    formatNumber(v, v !== null && Math.abs(v) < 10 ? 1 : 0, locale);
  return (
    <section className="report-sec" aria-labelledby="pc-focus">
      <h2 className="sec-title" id="pc-focus">
        <Target size={18} /> {t("Focus areas")}
      </h2>
      <div className="pc-focus-grid">
        {areas.map((f, i) => (
          <article key={i} className="pc-focus">
            <header>
              <span className="pc-focus-n">{i + 1}</span>
              <h3>{f.area}</h3>
            </header>
            {f.why && <p>{f.why}</p>}
            {(f.current !== null || f.target !== null) && (
              <div className="pc-target">
                {f.targetMetric && <small>{f.targetMetric}</small>}
                <div className="pc-target-vals">
                  <b>{n(f.current) ?? "–"}</b>
                  <ArrowRight size={14} />
                  <b className="goal">{n(f.target) ?? "–"}</b>
                </div>
                {f.progress !== null && (
                  <div
                    className="pc-bar"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={f.progress}
                    aria-label={t("Progress toward the target")}
                  >
                    <i style={{ width: `${f.progress}%` }} />
                  </div>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
