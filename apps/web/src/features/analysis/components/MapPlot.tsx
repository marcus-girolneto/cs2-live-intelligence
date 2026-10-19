"use client";
import { useMemo, useState } from "react";
import { formatNumber, placeName, weaponName } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import type { Marker } from "../model/insight/index";
type Point = { x: number; y: number };
const SIZE = 600;
const PAD = 36;

/**
 * Stylised radar of where the player got kills and died. Coordinates are fitted to the data
 * bounds (no map artwork); faint dots show every fight of the match to sketch the layout.
 */
export function MapPlot({
  markers,
  ghosts,
  mapLabel,
}: {
  markers: Marker[];
  ghosts: Point[];
  mapLabel: string | null;
}) {
  const { t, locale } = useI18n();
  const [filter, setFilter] = useState<"all" | "kill" | "death">("all");
  const [side, setSide] = useState<"all" | "CT" | "T">("all");
  const [active, setActive] = useState<number | null>(null);
  const shown = markers.filter(
    (m) =>
      (filter === "all" || m.kind === filter) &&
      (side === "all" || m.side === side),
  );
  const fit = useMemo(() => {
    const pts: Point[] = [
      ...ghosts,
      ...markers.flatMap((m) => [m, ...(m.other ? [m.other] : [])]),
    ];
    if (!pts.length) return null;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, maxY - minY, 200);
    const scale = (SIZE - PAD * 2) / span;
    const ox = PAD + (SIZE - PAD * 2 - (maxX - minX) * scale) / 2;
    const oy = PAD + (SIZE - PAD * 2 - (maxY - minY) * scale) / 2;
    return {
      // World Y grows "north"; SVG Y grows down.
      p: (pt: Point) => ({
        x: ox + (pt.x - minX) * scale,
        y: SIZE - (oy + (pt.y - minY) * scale),
      }),
    };
  }, [markers, ghosts]);
  if (!fit) return null;
  const kills = markers.filter((m) => m.kind === "kill").length;
  const deaths = markers.length - kills;
  const sel = active !== null ? shown[active] : undefined;
  const selP = sel ? fit.p(sel) : null;
  return (
    <div className="map-plot">
      <div className="map-plot-bar">
        <div className="segmented" role="group" aria-label={t("Show")}>
          {(
            [
              ["all", t("All ({n})", { n: markers.length })],
              ["kill", t("Kills ({n})", { n: kills })],
              ["death", t("Deaths ({n})", { n: deaths })],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => {
                setFilter(id);
                setActive(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label={t("Side")}>
          {(["all", "CT", "T"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={side === s}
              onClick={() => {
                setSide(s);
                setActive(null);
              }}
            >
              {s === "all" ? t("Both sides") : s}
            </button>
          ))}
        </div>
      </div>
      <div className="map-plot-stage">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={t("Map of your kills and deaths")}
          onClick={(e) => {
            if (e.target === e.currentTarget) setActive(null);
          }}
        >
          <defs>
            <pattern
              id="mp-grid"
              width="30"
              height="30"
              patternUnits="userSpaceOnUse"
            >
              <path d="M30 0H0V30" fill="none" stroke="rgba(160,180,205,.07)" />
            </pattern>
            <radialGradient id="mp-vig" cx="50%" cy="50%" r="70%">
              <stop offset="60%" stopColor="rgba(0,0,0,0)" />
              <stop offset="100%" stopColor="rgba(0,0,0,.55)" />
            </radialGradient>
            <marker
              id="mp-arrow"
              viewBox="0 0 6 6"
              refX="5"
              refY="3"
              markerWidth="5"
              markerHeight="5"
              orient="auto"
            >
              <path d="M0 0 6 3 0 6Z" fill="currentColor" />
            </marker>
          </defs>
          <rect width={SIZE} height={SIZE} className="mp-bg" />
          <rect width={SIZE} height={SIZE} fill="url(#mp-grid)" />
          <path
            d={`M${SIZE / 2} 0V${SIZE}M0 ${SIZE / 2}H${SIZE}`}
            className="mp-axis"
          />
          {[0.18, 0.33, 0.48].map((r) => (
            <circle
              key={r}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={SIZE * r}
              className="mp-ring"
            />
          ))}
          <g className="mp-ghosts">
            {ghosts.map((g, i) => {
              const p = fit.p(g);
              return <circle key={i} cx={p.x} cy={p.y} r={3} />;
            })}
          </g>
          {sel && selP && sel.other && (
            <line
              x1={sel.kind === "kill" ? selP.x : fit.p(sel.other).x}
              y1={sel.kind === "kill" ? selP.y : fit.p(sel.other).y}
              x2={sel.kind === "kill" ? fit.p(sel.other).x : selP.x}
              y2={sel.kind === "kill" ? fit.p(sel.other).y : selP.y}
              className={`mp-trace ${sel.kind}`}
              markerEnd="url(#mp-arrow)"
            />
          )}
          {sel?.other && (
            <circle
              cx={fit.p(sel.other).x}
              cy={fit.p(sel.other).y}
              r={6}
              className="mp-other"
            />
          )}
          {shown.map((m, i) => {
            const p = fit.p(m);
            const label = `${m.kind === "kill" ? t("Kill") : t("Death")} · ${t("Round {n}", { n: m.round })}${m.place ? ` · ${placeName(m.place)}` : ""}${m.weapon ? ` · ${weaponName(m.weapon)}` : ""}`;
            return (
              <g
                key={m.eventId}
                className={`mp-marker ${m.kind} ${m.side?.toLowerCase() ?? ""} ${active === i ? "on" : ""}`}
                transform={`translate(${p.x} ${p.y})`}
                tabIndex={0}
                role="button"
                aria-label={label}
                aria-pressed={active === i}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                style={{ animationDelay: `${Math.min(i * 25, 800)}ms` }}
              >
                <circle r={14} className="mp-hit" />
                {m.kind === "kill" ? (
                  <>
                    <circle r={7} className="mp-dot" />
                    {m.headshot && <circle r={10.5} className="mp-hs" />}
                  </>
                ) : (
                  <path d="M-6 -6 6 6M6 -6 -6 6" className="mp-x" />
                )}
              </g>
            );
          })}
          <rect
            width={SIZE}
            height={SIZE}
            fill="url(#mp-vig)"
            pointerEvents="none"
          />
          <text x="14" y="24" className="mp-label">
            {mapLabel ?? t("Radar")}
          </text>
          <text x={SIZE - 14} y="24" className="mp-label n" textAnchor="end">
            N ↑
          </text>
        </svg>
        {sel && selP && (
          <div
            className={`mp-tip ${sel.kind}`}
            style={{
              left: `${(selP.x / SIZE) * 100}%`,
              top: `${(selP.y / SIZE) * 100}%`,
            }}
            role="status"
          >
            <strong>
              {sel.kind === "kill" ? t("Kill") : t("Death")}
              {sel.headshot ? ` · ${t("Headshot")}` : ""}
            </strong>
            <span>
              {t("Round {n}", { n: sel.round })}
              {sel.place ? ` · ${placeName(sel.place)}` : ""}
            </span>
            {sel.weapon && <span>{weaponName(sel.weapon)}</span>}
            {sel.other && (
              <span className="muted">
                {t("{m} m away", {
                  m:
                    formatNumber(
                      Math.hypot(sel.x - sel.other.x, sel.y - sel.other.y) *
                        0.0254,
                      0,
                      locale,
                    ) ?? "0",
                })}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="map-legend">
        <span>
          <i className="lg-kill" /> {t("Your kill (where you stood)")}
        </span>
        <span>
          <i className="lg-hs" /> {t("Headshot")}
        </span>
        <span>
          <i className="lg-death" /> {t("Your death")}
        </span>
        <span>
          <i className="lg-ghost" /> {t("Other fights in this match")}
        </span>
      </div>
    </div>
  );
}
