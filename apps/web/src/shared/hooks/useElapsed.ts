"use client";
import { useEffect, useState } from "react";

/** Elapsed seconds since `since` (ms epoch), ticking 4×/s while mounted. */
export function useElapsed(since: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  return Math.max(0, (now - since) / 1000);
}
