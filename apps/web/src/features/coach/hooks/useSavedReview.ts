"use client";
import { useMemo } from "react";
import { useCoachProgress } from "@/features/maps";
import { savedReview } from "../model/session";

/** Latest stored review of one player in one match (null while loading or when none). */
export function useSavedReview(analysisId: string, steamId: string) {
  const { progress } = useCoachProgress();
  return useMemo(
    () => savedReview(progress, analysisId, steamId)?.coaching ?? null,
    [progress, analysisId, steamId],
  );
}
