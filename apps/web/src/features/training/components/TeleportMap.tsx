"use client";
import { useEffect, useMemo, useState } from "react";
import { useReplayApi, type ReplayMeta } from "@/features/replay";
import { useI18n } from "@/shared/i18n";
import type { Teleport } from "../model/types";

const W = 300;

/** Mini radar: the match's 2D outline with a numbered pin per teleport. */
export function TeleportMap({
  analysisId,
  teleports,
}: {
  analysisId: string | null;
  teleports: Teleport[];
}) {
  const { t } = useI18n();
  const api = useReplayApi();
  const [meta, setMeta] = useState<ReplayMeta | null>(null);
  useEffect(() => {
    if (!analysisId) return;
    let alive = true;
    api
      .getMeta(analysisId)
      .then((m) => alive && setMeta(m))
      .catch(() => alive && setMeta(null));
    return () => {
      alive = false;
    };
  }, [api, analysisId]);
  const fit = useMemo(() => {
    const xs = [
      ...teleports.map((p) => p.x),
      ...(meta ? [meta.bounds.minX, meta.bounds.maxX] : []),
    ];
    const ys = [
      ...teleports.map((p) => p.y),
      ...(meta ? [meta.bounds.minY, meta.bounds.maxY] : []),
    ];
    if (!xs.length) return null;
    const minX = Math.min(...xs) - 150;
    const maxY = Math.max(...ys) + 150;
    const span = Math.max(
      Math.max(...xs) + 150 - minX,
      maxY - (Math.min(...ys) - 150),
      600,
    );
    const k = W / span;
    return {
      k,
      h: Math.round((maxY - (Math.min(...ys) - 150)) * k),
      at: (x: number, y: number) => ({ x: (x - minX) * k, y: (maxY - y) * k }),
    };
  }, [meta, teleports]);
  if (!fit || !teleports.length) return null;
  const cell = (meta?.cell ?? 64) * fit.k;
  return (
    <figure className="tr-map">
      <svg
        viewBox={`0 0 ${W} ${Math.max(fit.h, 120)}`}
        role="img"
        aria-label={t("Map of your {n} practice spots", {
          n: teleports.length,
        })}
      >
        {meta?.outline.map(([x, y], i) => {
          const p = fit.at(x, y);
          return (
            <rect
              key={i}
              x={p.x - cell / 2}
              y={p.y - cell / 2}
              width={cell + 0.3}
              height={cell + 0.3}
              className="tr-map-cell"
            />
          );
        })}
        {teleports.map((tp, i) => {
          const p = fit.at(tp.x, tp.y);
          return (
            <g key={tp.id} className={`tr-pin ${tp.kind}`}>
              <circle cx={p.x} cy={p.y} r={7} />
              <text x={p.x} y={p.y + 3.5} textAnchor="middle">
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
