"use client";
import { useMemo } from "react";
import { useI18n } from "@/shared/i18n";
import { placeName } from "@/shared/format";
import type { NadeThrow, NadeType } from "../../model/deep";
import { NADE_LABEL } from "./nades";

const SIZE = 320;
const PAD = 22;

/** Mini radar of where the grenades landed (fitted to the data; no map artwork). */
export function NadePlot({ throws }: { throws: NadeThrow[] }) {
  const { t } = useI18n();
  const pts = throws.filter((n) => n.landing);
  const fit = useMemo(() => {
    const all = pts.flatMap((n) => [n.landing!, ...(n.from ? [n.from] : [])]);
    if (!all.length) return null;
    const xs = all.map((p) => p.x);
    const ys = all.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY, 300);
    const k = (SIZE - PAD * 2) / span;
    return (p: { x: number; y: number }) => ({
      x: PAD + (p.x - minX) * k,
      y: SIZE - PAD - (p.y - minY) * k,
    });
  }, [pts]);
  if (!fit || pts.length < 2) return null;
  const types = [...new Set(pts.map((n) => n.type))] as NadeType[];
  return (
    <figure className="nade-plot">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={t("Where your {n} grenades landed", { n: pts.length })}
      >
        <defs>
          <pattern
            id="np-grid"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path d="M20 0H0V20" fill="none" className="np-grid" />
          </pattern>
        </defs>
        <rect
          width={SIZE}
          height={SIZE}
          fill="url(#np-grid)"
          className="np-bg"
        />
        {pts.map((n, i) => {
          const a = fit(n.landing!);
          const b = n.from ? fit(n.from) : null;
          return (
            <g key={i} className={`np-nade ${n.type}`}>
              {b && (
                <line x1={b.x} y1={b.y} x2={a.x} y2={a.y} className="np-arc" />
              )}
              <circle cx={a.x} cy={a.y} r={n.type === "smoke" ? 9 : 5}>
                <title>
                  {[
                    t(NADE_LABEL[n.type]),
                    n.round !== null ? t("Round {n}", { n: n.round }) : null,
                    n.place ? placeName(n.place) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </title>
              </circle>
            </g>
          );
        })}
      </svg>
      <figcaption className="np-legend">
        {types.map((ty) => (
          <span key={ty}>
            <i className={`np-key ${ty}`} /> {t(NADE_LABEL[ty])}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
