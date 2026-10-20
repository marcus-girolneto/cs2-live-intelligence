"use client";
import { useI18n } from "@/shared/i18n";
import { placeName } from "@/shared/format";
import type { DeepCrosshair } from "../../model/deep";
import { CATEGORY_TEXT, HEIGHT_TEXT, SIDE_TEXT } from "../../model/deepText";
import { CrosshairTarget } from "./CrosshairTarget";

/**
 * Deep crosshair placement in player terms: how often it was already on the enemy, the
 * usual body height and side, a target with one dot per duel and the worst callouts.
 */
export function CrosshairPanel({ c }: { c: DeepCrosshair }) {
  const { t } = useI18n();
  const { onTarget, close, off, total } = c.preAim;
  const height = c.heightBand ? HEIGHT_TEXT[c.heightBand] : undefined;
  const side = c.horizontalBias ? SIDE_TEXT[c.horizontalBias] : undefined;
  const parts = [
    ["on", onTarget],
    ["close", close],
    ["off", off],
  ] as const;
  return (
    <div className="deep-block crosshair-panel">
      {c.summary && <p className="lead deep-summary">{c.summary}</p>}
      <div className="xh-grid">
        <div className="xh-stats">
          <p className="xh-main">
            {t("Crosshair already on the enemy in {n} of {total} duels", {
              n: onTarget,
              total,
            })}
          </p>
          <div className="xh-split" aria-hidden>
            {parts.map(([k, n]) =>
              n ? <i key={k} className={k} style={{ flexGrow: n }} /> : null,
            )}
          </div>
          <ul className="xh-cats">
            {parts.map(([k, n]) => (
              <li key={k} className={k} title={t(CATEGORY_TEXT[k]!.tip)}>
                <b className="tabular">{n}</b> {t(CATEGORY_TEXT[k]!.label)}
                <small className="muted">{t(CATEGORY_TEXT[k]!.tip)}</small>
              </li>
            ))}
          </ul>
          {height && (
            <p className={`xh-height ${c.heightBand}`}>
              <strong>{t(height.label)}</strong> <small>{t(height.tip)}</small>
            </p>
          )}
          {side && <p className="xh-side small">{t(side)}</p>}
        </div>
        {c.dots.length > 0 && <CrosshairTarget dots={c.dots} />}
      </div>
      {c.perCallout.some((w) => w.total > w.onTarget) && (
        <>
          <h4 className="deep-sub">{t("Where your crosshair drifts most")}</h4>
          <ul className="xh-worst">
            {c.perCallout
              .filter((w) => w.total > w.onTarget)
              .slice(0, 5)
              .map((w) => (
                <li key={w.callout}>
                  {t("{place}: crosshair off target in {n} of {total} duels", {
                    place: placeName(w.callout) ?? w.callout,
                    n: w.total - w.onTarget,
                    total: w.total,
                  })}
                </li>
              ))}
          </ul>
        </>
      )}
    </div>
  );
}
