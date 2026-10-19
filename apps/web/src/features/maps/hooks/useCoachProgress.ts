"use client";
import { useAsync } from "@/shared/hooks";
import { useMapsApi } from "../api/context";
import type { Progress } from "../model/progress";

/** GET coach/progress once per mount; `failed` instead of throwing. */
export function useCoachProgress() {
  const api = useMapsApi();
  const { data, error, setData } = useAsync(
    (signal) => api.getProgress(signal),
    [api],
  );
  return {
    progress: (data ?? null) as Progress | null,
    failed: error !== undefined,
    /** Raw error (for screens that show the server message). */
    error,
    setProgress: setData,
  };
}
