"use client";
import { useEffect, useState, type RefObject } from "react";

/**
 * True while the element is on screen (IntersectionObserver). Used to pause animations
 * off-screen; true when the browser has no IntersectionObserver.
 */
export function useInView(
  ref: RefObject<Element | null>,
  rootMargin = "0px",
): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setInView(!!entry?.isIntersecting),
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return inView;
}

/** The visitor asked for less motion (false during SSR). */
export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
