"use client";
import { useEffect, useRef } from "react";

/** Calls `tick` every `intervalMs` while `active` (and once immediately when `immediate`). */
export function usePolling(
  tick: () => void | Promise<void>,
  intervalMs: number,
  {
    active = true,
    immediate = false,
  }: { active?: boolean; immediate?: boolean } = {},
) {
  const ref = useRef(tick);
  ref.current = tick;
  useEffect(() => {
    if (!active) return;
    if (immediate) void ref.current();
    const id = setInterval(() => void ref.current(), intervalMs);
    return () => clearInterval(id);
  }, [active, immediate, intervalMs]);
}
