"use client";
import { useAsync } from "@/shared/hooks";
import { useAnalysisApi } from "../api/context";

/** Loads one stored analysis (idle while the id is null). */
export function useAnalysis(analysisId: string | null) {
  const api = useAnalysisApi();
  const { data, error, loading } = useAsync(
    (signal) => api.getAnalysis(analysisId!, signal),
    [api, analysisId],
    { enabled: !!analysisId },
  );
  return { data, error, loading };
}
