"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Types `text` out while `active` (resuming where it stopped); restarts when the text changes.
 * Shows the full text at once when `instant` (reduced motion).
 */
export function useTypewriter(
  text: string,
  active: boolean,
  { instant = false, cps = 38, delayMs = 300 } = {},
) {
  const [n, setN] = useState(0);
  const pos = useRef(0);
  useEffect(() => {
    pos.current = instant ? text.length : 0;
    setN(pos.current);
  }, [text, instant]);
  useEffect(() => {
    if (!active || instant) return;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      pos.current = Math.min(text.length, pos.current + 1);
      setN(pos.current);
      if (pos.current < text.length) timer = setTimeout(step, 1000 / cps);
    };
    timer = setTimeout(step, delayMs);
    return () => clearTimeout(timer);
  }, [text, active, instant, cps, delayMs]);
  const shown = instant ? text : text.slice(0, n);
  return { shown, done: shown.length >= text.length };
}
