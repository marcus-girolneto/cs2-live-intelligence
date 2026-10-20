"use client";
import { useEffect, useState } from "react";
import { useTrainingApi } from "../api/context";
import type { Catalog, Plan, Recommended } from "../model/types";

type Load<T> = { data: T | null; error: string; loading: boolean };
const msg = (e: unknown) =>
  e instanceof Error ? e.message : "Request failed.";

function useLoad<T>(key: string | null, load: () => Promise<T>): Load<T> {
  const [state, setState] = useState<Load<T>>({
    data: null,
    error: "",
    loading: !!key,
  });
  useEffect(() => {
    if (!key) return;
    let alive = true;
    setState({ data: null, error: "", loading: true });
    load()
      .then((data) => alive && setState({ data, error: "", loading: false }))
      .catch(
        (e: unknown) =>
          alive && setState({ data: null, error: msg(e), loading: false }),
      );
    return () => {
      alive = false;
    };
    // `load` closes over the inputs that make up `key`.
  }, [key]);
  return state;
}

/** The match's training plan for one player. */
export function useMatchTraining(
  analysisId: string | null,
  steamId: string | null,
): Load<Plan | null> {
  const api = useTrainingApi();
  return useLoad(
    analysisId && steamId ? `${analysisId}:${steamId}` : null,
    () => api.forAnalysis(analysisId!, steamId!),
  );
}

export function useCatalog(): Load<Catalog> {
  const api = useTrainingApi();
  return useLoad("catalog", () => api.catalog());
}

export function useRecommended(): Load<Recommended> {
  const api = useTrainingApi();
  return useLoad("recommended", () => api.recommended());
}
