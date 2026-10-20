"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCredits, useUpgrade, useUsage } from "@/features/billing";
import { useI18n } from "@/shared/i18n";
import { useCoachApi } from "../api/context";
import type { StoredTeamReview } from "../model/team";

/** Team review of the chosen player's team: stored reviews, run (credits) and view state. */
export function useTeamReview(
  analysisId: string | null,
  steamId: string | null,
) {
  const api = useCoachApi();
  const { lang } = useI18n();
  const credits = useCredits();
  const upgrade = useUpgrade();
  const { refresh } = useUsage();
  const [reviews, setReviews] = useState<StoredTeamReview[]>([]);
  const [running, setRunning] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [shown, setShown] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    setReviews([]);
    setShown(false);
    setError("");
    if (!analysisId || !steamId) return;
    let alive = true;
    api
      .listTeamReviews(analysisId, steamId)
      .then((r) => alive && setReviews(r))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [api, analysisId, steamId]);
  const run = useCallback(() => {
    if (!analysisId || !steamId) return;
    if (!credits.canAfford("team")) {
      upgrade.openCredits({
        needed: credits.cost("team"),
        balance: credits.balance,
        tier: "team",
      });
      return;
    }
    const id = ++seq.current;
    setRunning(Date.now());
    setError("");
    api
      .requestTeamReview(analysisId, steamId, lang)
      .then((r) => {
        if (seq.current !== id) return;
        setReviews((prev) => [r, ...prev]);
        setShown(true);
        void refresh();
      })
      .catch((e: unknown) => {
        if (seq.current !== id) return;
        if (upgrade.handle(e)) return;
        setError(e instanceof Error ? e.message : "Request failed.");
      })
      .finally(() => {
        if (seq.current === id) setRunning(null);
      });
  }, [analysisId, steamId, credits, upgrade, api, lang, refresh]);
  return {
    latest: reviews[0] ?? null,
    running,
    error,
    shown: shown && !!reviews[0],
    open: () => setShown(true),
    close: () => setShown(false),
    run,
  };
}
export type TeamReviewState = ReturnType<typeof useTeamReview>;
