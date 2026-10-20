"use client";
import { useI18n } from "@/shared/i18n";
import { scoreBasisText } from "../../model/scoreBasis";
import { DIMENSION_LABEL, type TeamScore } from "../../model/team";

const SIZE = 260;
const C = SIZE / 2;
const R = 92;

/** Five-axis radar of the team scores (0–100, team vs the enemy team). */
export function TeamRadar({ scores }: { scores: TeamScore[] }) {
  const { t, fmt } = useI18n();
  const n = scores.length;
  if (n < 3) return null;
  const at = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [C + Math.cos(a) * R * v, C + Math.sin(a) * R * v] as const;
  };
  const poly = scores.map((s, i) => at(i, s.value / 100).join(",")).join(" ");
  return (
    <figure className="team-radar">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={scores
          .map((s) => `${t(DIMENSION_LABEL[s.key])} ${s.value}`)
          .join(", ")}
      >
        {[0.25, 0.5, 0.75, 1].map((r) => (
          <polygon
            key={r}
            className="tr-ring"
            points={scores.map((_, i) => at(i, r).join(",")).join(" ")}
          />
        ))}
        {scores.map((_, i) => {
          const [x, y] = at(i, 1);
          return (
            <line key={i} className="tr-axis" x1={C} y1={C} x2={x} y2={y} />
          );
        })}
        <polygon className="tr-area" points={poly} />
        {scores.map((s, i) => {
          const [x, y] = at(i, s.value / 100);
          return <circle key={s.key} className="tr-dot" cx={x} cy={y} r={4} />;
        })}
      </svg>
      <ul className="tr-legend">
        {scores.map((s) => (
          <li key={s.key}>
            <span>{t(DIMENSION_LABEL[s.key])}</span>
            <b className="tabular">{s.value}</b>
            {s.basis && <small>{scoreBasisText(s.basis, t, fmt)}</small>}
          </li>
        ))}
      </ul>
    </figure>
  );
}
