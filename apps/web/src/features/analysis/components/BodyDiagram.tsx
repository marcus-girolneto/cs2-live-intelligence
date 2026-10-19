"use client";
import { useState } from "react";
import { formatNumber } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { BODY_REGIONS, type BodyRegion } from "../model/insight/index";
const STOPS: [number, [number, number, number]][] = [
  [0, [38, 52, 70]],
  [0.35, [92, 110, 130]],
  [0.6, [178, 138, 60]],
  [0.8, [242, 169, 59]],
  [1, [255, 106, 61]],
];
/** Heat colour for a 0..1 share (cold slate → CS orange → hot red-orange). */
export function heat(v: number) {
  const x = Math.max(0, Math.min(1, v));
  for (let i = 1; i < STOPS.length; i++) {
    const [p1, c1] = STOPS[i]!;
    const [p0, c0] = STOPS[i - 1]!;
    if (x <= p1) {
      const k = (x - p0) / (p1 - p0 || 1);
      const c = c0.map((a, j) => Math.round(a + (c1[j]! - a) * k));
      return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
    }
  }
  return "rgb(255, 106, 61)";
}

const SHAPES: Record<BodyRegion, string[]> = {
  head: [
    "M100 10c13 0 22 10 22 25 0 14-9 26-22 26s-22-12-22-26c0-15 9-25 22-25Z",
    "M91 60h18v12H91Z",
  ],
  chest: ["M66 76c10-5 22-6 34-6s24 1 34 6l6 10 2 62H58l2-62Z"],
  stomach: ["M58 152h84l-4 54H62Z"],
  arms: [
    "M62 78 50 82c-6 3-9 9-10 16l-8 66-6 54 14 2 9-54 9-46 4-30Z",
    "M138 78l12 4c6 3 9 9 10 16l8 66 6 54-14 2-9-54-9-46-4-30Z",
  ],
  legs: [
    "M62 210h36l-2 70-3 70H73l-4-70Z",
    "M102 210h36l-7 70-4 70h-20l-3-70Z",
  ],
};
const LABEL: Record<BodyRegion, string> = {
  head: "Head",
  chest: "Chest",
  stomach: "Stomach",
  arms: "Arms",
  legs: "Legs",
};

/** Hit-group silhouette: each region heat-coloured by its share of the player's hits. */
export function BodyDiagram({
  hits,
  total,
  compare,
  compact,
}: {
  hits: Record<BodyRegion, number>;
  total: number;
  /** Match-average share per region (0..100) for the comparison column. */
  compare?: Partial<Record<BodyRegion, number | null>>;
  compact?: boolean;
}) {
  const { t, locale } = useI18n();
  const [focus, setFocus] = useState<BodyRegion | null>(null);
  const max = Math.max(1, ...BODY_REGIONS.map((r) => hits[r]));
  const share = (r: BodyRegion) => (total > 0 ? (hits[r] / total) * 100 : 0);
  // Bars are scaled to the largest share (or match average) so differences stay visible.
  const scale = Math.max(
    1,
    ...BODY_REGIONS.map((r) => Math.max(share(r), compare?.[r] ?? 0)),
  );
  return (
    <div className={`body-diagram ${compact ? "compact" : ""}`}>
      <svg
        viewBox="0 0 200 360"
        className="body-svg"
        role="img"
        aria-label={t("Where your hits landed")}
      >
        <defs>
          <pattern
            id="bd-grid"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
          >
            <path d="M8 0H0V8" fill="none" stroke="rgba(160,180,205,.07)" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="200" height="360" fill="url(#bd-grid)" />
        {BODY_REGIONS.map((r) =>
          SHAPES[r].map((d, i) => (
            <path
              key={`${r}${i}`}
              d={d}
              className={`bd-region ${focus === r ? "on" : ""} ${focus && focus !== r ? "dim" : ""}`}
              style={{
                fill:
                  hits[r] > 0 ? heat(hits[r] / max) : "rgba(160,180,205,.08)",
              }}
              onMouseEnter={() => setFocus(r)}
              onMouseLeave={() => setFocus(null)}
            >
              <title>
                {t("{part}: {n} hits ({pct}%)", {
                  part: t(LABEL[r]),
                  n: hits[r],
                  pct: formatNumber(share(r), 0, locale) ?? "0",
                })}
              </title>
            </path>
          )),
        )}
        {/* crosshair on the head: the target zone */}
        <g className="bd-xhair" aria-hidden>
          <path d="M100 18v8M100 44v8M83 35h8M109 35h8" />
        </g>
      </svg>
      <ul className="bd-legend">
        {BODY_REGIONS.map((r) => {
          const s = share(r);
          const avg = compare?.[r];
          return (
            <li
              key={r}
              className={focus === r ? "on" : ""}
              onMouseEnter={() => setFocus(r)}
              onMouseLeave={() => setFocus(null)}
            >
              <span
                className="bd-swatch"
                style={{
                  background:
                    hits[r] > 0 ? heat(hits[r] / max) : "rgba(160,180,205,.15)",
                }}
              />
              <span className="bd-name">{t(LABEL[r])}</span>
              <span className="bd-bar">
                <i
                  style={{
                    width: `${(s / scale) * 100}%`,
                    background: heat(hits[r] / max),
                  }}
                />
                {avg != null && (
                  <b
                    className="bd-avg"
                    style={{ left: `${Math.min(100, (avg / scale) * 100)}%` }}
                    title={t("Match average {pct}%", {
                      pct: formatNumber(avg, 0, locale) ?? "0",
                    })}
                  />
                )}
              </span>
              <span className="bd-pct">{formatNumber(s, 0, locale)}%</span>
              <span className="bd-count">{t("{n} hits", { n: hits[r] })}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
