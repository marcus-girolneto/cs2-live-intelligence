"use client";
import { useEffect, useState } from "react";

/** Current time, refreshed every `intervalMs` (default 30 s) so countdowns stay current. */
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
