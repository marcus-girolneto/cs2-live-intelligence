"use client";
import { useI18n } from "@/shared/i18n";
import type { DeepCrosshair } from "../../model/deep";

/** Pixels per body unit (16 world units, half a player's width). */
const S = 22;
/** Visible area after compression: x ±3.8, y +2.6 (above the head) .. -3.3 (feet). */
const X = 3.8;
const TOP = 2.6;
const BOTTOM = -3.3;
/** Padding so dots on the edge stay whole. */
const PAD = 8;
/** Near the body the scale is true; far misses are compressed so they stay visible. */
const squash = (v: number) => {
  const a = Math.abs(v);
  return Math.sign(v) * (a <= 1.5 ? a : 1.5 + Math.log2(a - 0.5) * 0.9);
};
const px = (x: number) => PAD + (Math.max(-X, Math.min(X, squash(x))) + X) * S;
const py = (y: number) =>
  PAD + (TOP - Math.max(BOTTOM, Math.min(TOP, squash(y)))) * S;

/**
 * Where the crosshair was relative to the enemy when each duel started: a standing player
 * (eyes at 0, feet at -4 body units) and one dot per duel, green when you won it.
 */
export function CrosshairTarget({ dots }: { dots: DeepCrosshair["dots"] }) {
  const { t } = useI18n();
  const w = 2 * X * S + 2 * PAD;
  const h = (TOP - BOTTOM) * S + 2 * PAD;
  return (
    <figure className="xh-target">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={t("Where your crosshair was when each duel started")}
      >
        <g className="xh-body" aria-hidden>
          {/* A standing player: eyes 0, shoulders -0.6, hips -2.1, feet -4. */}
          <circle cx={px(0)} cy={py(0.15)} r={0.42 * S} />
          <rect
            x={px(-0.22)}
            y={py(0)}
            width={px(0.22) - px(-0.22)}
            height={py(-0.6) - py(0)}
          />
          <rect
            x={px(-0.8)}
            y={py(-0.55)}
            width={px(0.8) - px(-0.8)}
            height={py(-2.1) - py(-0.55)}
            rx={0.3 * S}
          />
          {[-0.75, 0.08].map((x) => (
            <rect
              key={x}
              x={px(x)}
              y={py(-2.1)}
              width={px(x + 0.67) - px(x)}
              height={py(-4) - py(-2.1)}
              rx={6}
            />
          ))}
          <line className="xh-eyes" x1={0} x2={w} y1={py(0)} y2={py(0)} />
        </g>
        {dots.map((d, i) => (
          <circle
            key={i}
            className={`xh-dot-${d.won === undefined ? "na" : d.won ? "won" : "lost"} ${d.category}`}
            cx={px(d.x)}
            cy={py(d.y)}
            r={5}
          />
        ))}
      </svg>
      <figcaption className="muted small">
        <span className="xh-key won" /> {t("Duel won")}{" "}
        <span className="xh-key lost" /> {t("Duel lost")}{" "}
        <span className="xh-key na" /> {t("No winner")}
      </figcaption>
    </figure>
  );
}
