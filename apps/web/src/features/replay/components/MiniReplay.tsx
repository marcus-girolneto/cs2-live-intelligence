"use client";
import { useEffect, useMemo, useRef } from "react";
import { BRAND } from "@/shared/brand";
import { REDUCED_MOTION, useInView, useMediaQuery } from "@/shared/hooks";
import { useI18n } from "@/shared/i18n";
import { drawScene, type RenderCache } from "../model/draw";
import type { ReplayMeta, ReplayWindow } from "../model/replay";

/**
 * Autoplaying, control-less 2D replay of one window (landing previews). Loops while on
 * screen, pauses off-screen, and shows a still of the key moment under reduced motion.
 */
export function MiniReplay({
  meta,
  win,
  focusSteamId,
  at,
  speed = 1,
  label,
}: {
  meta: ReplayMeta;
  win: ReplayWindow;
  focusSteamId?: string;
  at?: number;
  speed?: number;
  /** Accessible description of what the clip shows. */
  label: string;
}) {
  const { t } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const cache = useRef<RenderCache>({ key: "", canvas: null });
  const clock = useRef(win.from);
  const visible = useInView(box);
  const reduced = useMediaQuery(REDUCED_MOTION);
  const focus = useMemo(() => {
    const i = win.players.findIndex((p) => p.steamId === focusSteamId);
    return i >= 0 ? i : null;
  }, [win.players, focusSteamId]);
  const scene = useMemo(
    () => ({
      brand: BRAND.name,
      roundLabel: t("Round {n}", { n: win.round }),
      keyLabel: t("Key moment"),
    }),
    [t, win.round],
  );
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    const holder = box.current;
    if (!el || !ctx || !holder) return;
    const draw = (time: number, now: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = holder.clientWidth;
      const h = holder.clientHeight;
      if (!w || !h) return;
      if (el.width !== Math.round(w * dpr)) el.width = Math.round(w * dpr);
      if (el.height !== Math.round(h * dpr)) el.height = Math.round(h * dpr);
      drawScene(
        ctx,
        w,
        h,
        dpr,
        meta,
        win,
        time,
        {
          ...scene,
          focus,
          ...(at !== undefined ? { at } : {}),
          reducedMotion: reduced,
          clock: now / 1000,
        },
        cache.current,
      );
    };
    if (reduced || !visible) {
      draw(reduced ? (at ?? win.to) : clock.current, performance.now());
      return;
    }
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      clock.current += dt * speed;
      // Hold the last second, then loop.
      if (clock.current > win.to + 1) clock.current = win.from;
      draw(Math.min(clock.current, win.to), now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [meta, win, focus, at, speed, scene, reduced, visible]);
  return (
    <div ref={box} className="mini-replay" role="img" aria-label={label}>
      <canvas ref={canvas} />
    </div>
  );
}
