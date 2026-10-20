"use client";
import { useEffect, useRef, useState } from "react";
import { finite } from "../format";
import { useI18n } from "../i18n";

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Animated number (ease-out count-up). Non-finite values render the fallback. */
export function CountUp({
  value,
  digits = 0,
  suffix = "",
  prefix = "",
  fallback = "–",
  duration = 900,
}: {
  value: unknown;
  digits?: number;
  suffix?: string;
  prefix?: string;
  fallback?: string;
  duration?: number;
}) {
  const { locale } = useI18n();
  const target = finite(value);
  const [shown, setShown] = useState<number | null>(target === null ? null : 0);
  const from = useRef(0);
  useEffect(() => {
    if (target === null) return setShown(null);
    if (reduced()) return setShown(target);
    let raf = 0;
    const start = performance.now();
    const origin = from.current;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(origin + (target - origin) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  if (target === null || shown === null) return <>{fallback}</>;
  return (
    <>
      {prefix}
      {shown.toLocaleString(locale, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })}
      {suffix}
    </>
  );
}
