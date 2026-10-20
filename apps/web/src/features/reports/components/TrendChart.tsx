"use client";
import { useId, useState } from "react";
import { formatNumber } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Trend } from "@/shared/icons";
import { seriesDelta, type Series } from "../model/report";

const W = 320;
const H = 120;
const P = { l: 6, r: 6, t: 12, b: 8 };

/** One metric over the month: headline value, change, a 2px line with hover read-out. */
export function TrendChart({ s }: { s: Series }) {
  const { t, locale } = useI18n();
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const vals = s.points.map((p) => p.value);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = (hi - lo || Math.max(1, Math.abs(hi))) * 0.15;
  const y = (v: number) =>
    P.t + (1 - (v - (lo - pad)) / (hi - lo + pad * 2 || 1)) * (H - P.t - P.b);
  const x = (i: number) => P.l + (i / (s.points.length - 1)) * (W - P.l - P.r);
  const path = s.points
    .map((p, i) => `${i ? "L" : "M"}${x(i)} ${y(p.value)}`)
    .join(" ");
  const area = `${path} L${x(s.points.length - 1)} ${H} L${x(0)} ${H} Z`;
  const digits = Math.abs(hi) < 10 ? 2 : Math.abs(hi) < 100 ? 1 : 0;
  const fmt = (v: number) =>
    `${formatNumber(v, digits, locale) ?? "–"}${s.unit}`;
  const d = seriesDelta(s);
  const shown = hover !== null ? s.points[hover]! : null;
  return (
    <figure className="trend-card">
      <figcaption>
        <span className="tc-label">{t(s.label)}</span>
        <b className="tabular">{fmt(shown?.value ?? d.last)}</b>
        {shown ? (
          <small className="muted">{shown.label}</small>
        ) : (
          <small
            className={`tc-delta ${d.delta === 0 ? "" : d.good ? "good" : "bad"}`}
          >
            <Trend size={14} className={d.delta < 0 ? "down" : ""} />
            {d.delta > 0 ? "+" : d.delta < 0 ? "−" : "±"}
            {formatNumber(Math.abs(d.delta), digits, locale)}
            {s.unit} {t("this month")}
          </small>
        )}
      </figcaption>
      <svg
        className="tc-plot"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${t(s.label)}: ${s.points.map((p) => `${p.label} ${fmt(p.value)}`).join(", ")}`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`${id}-f`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="tc-fill-top" />
            <stop offset="100%" className="tc-fill-bottom" />
          </linearGradient>
        </defs>
        <line
          x1={P.l}
          x2={W - P.r}
          y1={y(s.points[0]!.value)}
          y2={y(s.points[0]!.value)}
          className="tc-base"
        />
        <path d={area} fill={`url(#${id}-f)`} />
        <path d={path} className="tc-line" />
        {hover !== null && (
          <>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={P.t}
              y2={H - P.b}
              className="tc-cross"
            />
            <circle
              cx={x(hover)}
              cy={y(s.points[hover]!.value)}
              r="5"
              className="tc-dot"
            />
          </>
        )}
        <circle
          cx={x(s.points.length - 1)}
          cy={y(d.last)}
          r="4"
          className="tc-dot end"
        />
        {s.points.map((p, i) => (
          <rect
            key={i}
            x={x(i) - W / s.points.length / 2}
            y={0}
            width={W / s.points.length}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          >
            <title>{`${p.label}: ${fmt(p.value)}`}</title>
          </rect>
        ))}
      </svg>
    </figure>
  );
}
