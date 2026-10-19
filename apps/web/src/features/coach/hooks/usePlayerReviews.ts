"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Progress } from "@/features/maps";
import { useCoachApi } from "../api/context";
import { normalizeCoaching, type ReviewTier } from "../model/coaching";
import { savedReview, type SavedReview } from "../model/session";

export type TierReview = SavedReview & { tier: ReviewTier; fresh?: boolean };
export type TierReviews = Partial<Record<ReviewTier, TierReview>>;

const fresh = (t: TierReviews | null): TierReviews =>
  Object.fromEntries(
    Object.entries(t ?? {}).filter(([, r]) => r?.fresh),
  ) as TierReviews;

/**
 * Stored reviews of one player in one match, latest per tier (GET reviews). Older APIs
 * without that endpoint fall back to the newest review from the progress feed (as Quick).
 */
export function usePlayerReviews(
  analysisId: string | null,
  steamId: string | null,
  progress: Progress | null,
) {
  const api = useCoachApi();
  const [byTier, setByTier] = useState<TierReviews | null>(null);
  const [version, setVersion] = useState(0);
  const key = useRef("");
  useEffect(() => {
    const k = `${analysisId}:${steamId}`;
    if (key.current !== k) setByTier(null);
    key.current = k;
    if (!analysisId || !steamId) return;
    let alive = true;
    api
      .listReviews(analysisId, steamId)
      .then((list) => {
        const out: TierReviews = {};
        for (const r of list) {
          const coaching = normalizeCoaching(r.coaching);
          const tier: ReviewTier = r.tier ?? coaching.tier ?? "quick";
          if (out[tier]) continue;
          out[tier] = {
            id: r.id,
            createdAt: r.createdAt,
            rating: null,
            coaching: { ...coaching, tier },
            tier,
          };
        }
        return out;
      })
      .catch(() => {
        const saved = savedReview(progress, analysisId, steamId);
        if (!saved) return {};
        const tier: ReviewTier = saved.coaching.tier ?? "quick";
        return { [tier]: { ...saved, tier } } as TierReviews;
      })
      .then((out) => {
        // Keep a review written just now even if the list lags behind.
        if (alive) setByTier((current) => ({ ...out, ...fresh(current) }));
      });
    return () => {
      alive = false;
    };
  }, [api, analysisId, steamId, version, progress]);
  /** Merge a review that was just written (no refetch needed). */
  const add = useCallback((r: TierReview) => {
    setByTier((current) => ({ ...(current ?? {}), [r.tier]: r }));
  }, []);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { byTier, add, reload };
}
