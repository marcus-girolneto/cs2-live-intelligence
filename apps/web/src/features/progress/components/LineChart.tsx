"use client";
import { formatNumber } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
export function LineChart({
  points,
  unit,
  digits,
}: {
  points: { v: number; label: string; href: string; map: string | null }[];
  unit: string;
  digits: number;
}) {
  const { locale } = useI18n();
  const W = 720;
  const H = 220;
  const P = { l: 44, r: 16, t: 20, b: 28 };
  const vals = points.map((p) => p.v);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const pad = (max - min || Math.max(1, max)) * 0.2;
  const lo = Math.max(0, min - pad);
  const hi = max + pad;
  const x = (i: number) =>
    points.length === 1
      ? (P.l + W - P.r) / 2
      : P.l + (i / (points.length - 1)) * (W - P.l - P.r);
  const y = (v: number) =>
    P.t + (1 - (v - lo) / (hi - lo || 1)) * (H - P.t - P.b);
  const path = points
    .map((p, i) => `${i ? "L" : "M"}${x(i)} ${y(p.v)}`)
    .join(" ");
  const area = `${path} L${x(points.length - 1)} ${H - P.b} L${x(0)} ${H - P.b} Z`;
  const ticks = [lo, (lo + hi) / 2, hi];
  const fmt = (v: number) => `${formatNumber(v, digits, locale)}${unit}`;
  return (
    <div className="line-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={points.map((p) => `${p.label}: ${fmt(p.v)}`).join("; ")}
      >
        <defs>
          <linearGradient id="lc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(242,169,59,.35)" />
            <stop offset="100%" stopColor="rgba(242,169,59,0)" />
          </linearGradient>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line
              x1={P.l}
              x2={W - P.r}
              y1={y(v)}
              y2={y(v)}
              className="lc-grid"
            />
            <text x={P.l - 8} y={y(v) + 4} textAnchor="end" className="lc-tick">
              {formatNumber(v, digits > 1 ? 1 : 0, locale)}
            </text>
          </g>
        ))}
        <path d={area} fill="url(#lc-fill)" className="lc-area" />
        <path d={path} className="lc-line" />
        {points.map((p, i) => (
          <a key={i} href={p.href} aria-label={`${p.label}: ${fmt(p.v)}`}>
            <circle cx={x(i)} cy={y(p.v)} r={5} className="lc-dot">
              <title>{`${p.label}: ${fmt(p.v)}`}</title>
            </circle>
            <text
              x={x(i)}
              y={y(p.v) - 12}
              textAnchor="middle"
              className="lc-val"
            >
              {fmt(p.v)}
            </text>
            <text x={x(i)} y={H - 8} textAnchor="middle" className="lc-tick">
              {i + 1}
            </text>
          </a>
        ))}
      </svg>
    </div>
  );
}
