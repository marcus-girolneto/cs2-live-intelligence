import {
  summarizeCrosshair,
  type CrosshairDuel,
} from "@cs2/contracts/crosshair";
import { finite, text } from "@/shared/format";
import type { DeepCrosshair } from "./deepTypes";
import { arr, obj, opt } from "./parse";

const count = (v: unknown) => {
  const n = finite(v);
  return n === null || n < 0 ? null : Math.round(n);
};
const HEIGHTS = ["above", "head", "neck", "chest", "stomach", "legs"] as const;
/**
 * Crosshair section: the server's player-facing summary, or the same summary computed from
 * the stored duels of older reviews. Without duels (or summary) there is nothing to show:
 * degree numbers are never displayed.
 */
export function parseCrosshair(raw: unknown): DeepCrosshair | undefined {
  const o = obj(raw);
  if (!o) return undefined;
  const duels: CrosshairDuel[] = arr(o.samples)
    .map(obj)
    .flatMap((x) => {
      const offset = x && finite(x.offset);
      const distance = x && finite(x.distance);
      if (!x || offset === null || distance === null) return [];
      const yawError = finite(x.yawError);
      return [
        {
          offset,
          distance,
          pitchError: finite(x.pitchError) ?? 0,
          yawOffset: finite(x.yawOffset) ?? offset,
          ...(yawError !== null ? { yawError } : {}),
          ...opt("place", text(x.place)),
          ...(typeof x.won === "boolean" ? { won: x.won } : {}),
        },
      ];
    });
  const computed = duels.length ? summarizeCrosshair(duels) : null;
  const pre = obj(o.preAim);
  const preAim =
    pre && count(pre.total)
      ? {
          onTarget: count(pre.onTarget) ?? 0,
          close: count(pre.close) ?? 0,
          off: count(pre.off) ?? 0,
          total: count(pre.total)!,
        }
      : computed?.preAim;
  if (!preAim?.total) return undefined;
  const band = HEIGHTS.find((h) => h === o.heightBand);
  const side = (["left", "right", "centered"] as const).find(
    (h) => h === o.horizontalBias,
  );
  const perCallout = arr(o.perCallout)
    .map(obj)
    .flatMap((x) => {
      const callout = x && text(x.callout);
      const total = x && count(x.total);
      return x && callout && total
        ? [{ callout, onTarget: count(x.onTarget) ?? 0, total }]
        : [];
    });
  const dots = arr(o.dots)
    .map(obj)
    .flatMap((x) => {
      const dx = x && finite(x.x);
      const dy = x && finite(x.y);
      const category = (["on", "close", "off"] as const).find(
        (c) => c === x?.category,
      );
      return x && dx !== null && dy !== null && category
        ? [
            {
              x: dx,
              y: dy,
              category,
              ...(typeof x.won === "boolean" ? { won: x.won } : {}),
            },
          ]
        : [];
    });
  return {
    ...opt("summary", text(o.summary)),
    preAim,
    heightBand: band ?? computed?.heightBand ?? null,
    horizontalBias: side ?? computed?.horizontalBias ?? null,
    perCallout: perCallout.length ? perCallout : (computed?.perCallout ?? []),
    dots: dots.length ? dots : (computed?.dots ?? []),
  };
}
