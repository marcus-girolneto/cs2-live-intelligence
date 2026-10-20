"use client";
import { useState } from "react";
import { useI18n } from "@/shared/i18n";
import { scoreBasisText } from "../model/scoreBasis";
import { formatNumber } from "@/shared/format";
import type { CoachScore, ScoreKey } from "../model/coaching";

export const LABELS: Record<ScoreKey, string> = {
  aim: "Aim",
  positioning: "Positioning",
  utility: "Utility",
  trading: "Trading",
  economy: "Economy",
  impact: "Impact",
};
const SIZE = 300;
const C = SIZE / 2;
const R = 112;

/**
 * Hexagon radar of the six coach scores (0–100) against the lobby-average ring (50).
 * The list beside it carries the same numbers and their basis (table view / no colour-only).
 */
export function ScoreRadar({ scores }: { scores: CoachScore[] }) {
  const { t, locale, fmt } = useI18n();
  const [active, setActive] = useState<ScoreKey | null>(null);
  const n = scores.length;
  if (n < 3) return null;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [
      C + Math.cos(a) * R * (v / 100),
      C + Math.sin(a) * R * (v / 100),
    ] as const;
  };
  const poly = (v: (i: number) => number) =>
    scores.map((_, i) => pt(i, v(i)).join(",")).join(" ");
  const label = (s: CoachScore) => t(LABELS[s.key]);
  return (
    <div className="radar">
      <svg
        viewBox={`-56 4 ${SIZE + 112} ${SIZE - 8}`}
        role="img"
        aria-label={scores
          .map((s) => `${label(s)} ${Math.round(s.value)}`)
          .join(", ")}
      >
        {[25, 50, 75, 100].map((v) => (
          <polygon
            key={v}
            points={poly(() => v)}
            className={`rd-ring ${v === 100 ? "outer" : ""}`}
          />
        ))}
        {scores.map((_, i) => {
          const [x, y] = pt(i, 100);
          return (
            <line key={i} x1={C} y1={C} x2={x} y2={y} className="rd-axis" />
          );
        })}
        <polygon points={poly(() => 50)} className="rd-lobby" />
        <polygon points={poly((i) => scores[i]!.value)} className="rd-you" />
        {scores.map((s, i) => {
          const [x, y] = pt(i, s.value);
          const [lx, ly] = pt(i, 122);
          const on = active === s.key;
          return (
            <g key={s.key}>
              <circle cx={x} cy={y} r={on ? 7 : 5} className="rd-dot">
                <title>{`${label(s)}: ${Math.round(s.value)}${s.basis ? ` (${scoreBasisText(s.basis, t, fmt)})` : ""}`}</title>
              </circle>
              <text
                x={lx}
                y={ly}
                textAnchor={
                  Math.abs(lx - C) < 8 ? "middle" : lx > C ? "start" : "end"
                }
                dominantBaseline="middle"
                className={`rd-label ${on ? "on" : ""}`}
              >
                {label(s)}
                <tspan className="rd-val"> {Math.round(s.value)}</tspan>
              </text>
            </g>
          );
        })}
      </svg>
      <div className="radar-side">
        <div className="radar-legend" aria-hidden>
          <span>
            <i className="lg-you" /> {t("You")}
          </span>
          <span>
            <i className="lg-lobby" /> {t("Lobby average")}
          </span>
        </div>
        <ul className="score-list">
          {scores.map((s) => (
            <li
              key={s.key}
              tabIndex={0}
              onMouseEnter={() => setActive(s.key)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(s.key)}
              onBlur={() => setActive(null)}
              className={s.value >= 60 ? "good" : s.value < 45 ? "bad" : ""}
            >
              <span className="sl-name">{label(s)}</span>
              <span className="sl-bar" aria-hidden>
                <i style={{ width: `${s.value}%` }} />
                <b style={{ left: "50%" }} />
              </span>
              <span className="sl-val">{formatNumber(s.value, 0, locale)}</span>
              {s.basis && (
                <small className="sl-basis">
                  {scoreBasisText(s.basis, t, fmt)}
                </small>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
