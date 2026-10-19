"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncState<T> = {
  data: T | undefined;
  error: unknown;
  loading: boolean;
};
export type AsyncResult<T> = AsyncState<T> & {
  /** Runs the loader again (aborting the previous run). */
  refresh: () => Promise<void>;
  /** Local update of the cached data (optimistic edits, saved responses). */
  setData: (next: T | ((previous: T | undefined) => T)) => void;
};
export type AsyncOptions = {
  /** When false the loader does not run (state stays idle). Default true. */
  enabled?: boolean;
  /** Keep the previous data visible while reloading. Default true. */
  keepPrevious?: boolean;
};

/**
 * Query-like hook: runs `load` when `deps` change, exposing data/error/loading and a
 * refresh. Each run gets an AbortSignal that is aborted on unmount or re-run, and stale
 * results are ignored.
 */
export function useAsync<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
  { enabled = true, keepPrevious = true }: AsyncOptions = {},
): AsyncResult<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: undefined,
    error: undefined,
    loading: enabled,
  });
  const loadRef = useRef(load);
  loadRef.current = load;
  const controller = useRef<AbortController | null>(null);
  const run = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setState((s) => ({
      data: keepPrevious ? s.data : undefined,
      error: undefined,
      loading: true,
    }));
    try {
      const data = await loadRef.current(current.signal);
      if (!current.signal.aborted)
        setState({ data, error: undefined, loading: false });
    } catch (error) {
      if (!current.signal.aborted)
        setState((s) => ({ data: s.data, error, loading: false }));
    }
  }, [keepPrevious]);
  useEffect(() => {
    if (!enabled) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    void run();
    return () => controller.current?.abort();
  }, [enabled, run, ...deps]);
  const setData = useCallback(
    (next: T | ((previous: T | undefined) => T)) =>
      setState((s) => ({
        ...s,
        data:
          typeof next === "function"
            ? (next as (p: T | undefined) => T)(s.data)
            : next,
      })),
    [],
  );
  return { ...state, refresh: run, setData };
}
