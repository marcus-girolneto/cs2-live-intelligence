"use client";
import { useI18n } from "@/shared/i18n";
import type { DeepCrosshair } from "../../model/deep";

/** Pixels per body unit (16 world units, half a player's width). */
const S = 22;
/** Visible area in body units: x -4..4, y +2.5 (above the head) .. -4.6 (feet). */
const X = 4;
const TOP = 2.5;
const BOTTOM = -4.6;
const px = (x: number) => (Math.max(-X, Math.min(X, x)) + X) * S;
const py = (y: number) => (TOP - Math.max(BOTTOM, Math.min(TOP, y))) * S;

/**
 * Where the crosshair was relative to the enemy when each duel started: a standing player
 * (eyes at 0, feet at -4 body units) and one dot per duel, green when you won it.
 */
export function CrosshairTarget({ dots }: { dots: DeepCrosshair["dots"] }) {
  const { t } = useI18n();
  const w = 2 * X * S;
  const h = (TOP - BOTTOM) * S;
  return (
    <figure className="xh-target">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={t("Where your crosshair was when each duel started")}
      >
        <g className="xh-body" aria-hidden>
          <circle cx={px(0)} cy={py(0.15)} r={0.42 * S} />
          <rect x={px(-0.22)} y={py(-0.3)} width={0.44 * S} height={0.3 * S} />
          <rect
            x={px(-0.8)}
            y={py(-0.55)}
            width={1.6 * S}
            height={1.9 * S}
            rx={0.3 * S}
          />
          <rect
            x={px(-0.75)}
            y={py(-2.4)}
            width={0.65 * S}
            height={2.2 * S}
            rx={6}
          />
          <rect
            x={px(0.1)}
            y={py(-2.4)}
            width={0.65 * S}
            height={2.2 * S}
            rx={6}
          />
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
