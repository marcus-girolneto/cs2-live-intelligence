"use client";
import { useEffect, useState } from "react";

/** Live result of a CSS media query (false during SSR and the first render). */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const list = window.matchMedia?.(query);
    if (!list) return;
    setMatches(list.matches);
    const change = (e: MediaQueryListEvent) => setMatches(e.matches);
    list.addEventListener("change", change);
    return () => list.removeEventListener("change", change);
  }, [query]);
  return matches;
}
