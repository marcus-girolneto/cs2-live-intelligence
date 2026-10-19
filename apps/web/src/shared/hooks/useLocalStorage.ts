"use client";
import { useCallback, useEffect, useState } from "react";

/**
 * A value persisted in localStorage under `key` (read after mount so SSR markup matches).
 * Storage failures (private mode) are ignored: the value simply isn't remembered.
 */
export function useLocalStorage<T>(
  key: string,
  initial: T,
  parse: (raw: string) => T | null = (raw) => JSON.parse(raw) as T,
) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw === null ? null : parse(raw);
      if (parsed !== null) setValue(parsed);
    } catch {
      /* unreadable or unavailable storage */
    }
  }, [key]);
  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
    },
    [key],
  );
  return [value, update] as const;
}
