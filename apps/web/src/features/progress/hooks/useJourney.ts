"use client";
import { useCallback, useEffect, useState } from "react";
import { useProgressApi } from "../api/context";
import type { Journey } from "../model/journey";

/** Loads the progress journey for a map (null = all maps) and sets the identity. */
export function useJourney(map: string | null) {
  const api = useProgressApi();
  const [data, setData] = useState<Journey | null>(null);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    setError("");
    api
      .getJourney(map, ctrl.signal)
      .then(setData)
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted)
          setError(e instanceof Error ? e.message : "Request failed.");
      });
    return () => ctrl.abort();
  }, [api, map, nonce]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const chooseIdentity = useCallback(
    async (steamId: string) => {
      await api.setIdentity(steamId);
      reload();
    },
    [api, reload],
  );
  const rate = useCallback(
    async (id: string, rating: number) => {
      await api.rateReview(id, rating).catch(() => undefined);
      setData(
        (d) =>
          d && {
            ...d,
            reviews: d.reviews.map((r) => (r.id === id ? { ...r, rating } : r)),
          },
      );
    },
    [api],
  );
  return { data, error, reload, chooseIdentity, rate };
}
