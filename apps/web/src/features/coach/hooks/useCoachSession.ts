"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUpgrade, useUsage } from "@/features/billing";
import { useMapsApi, type Progress } from "@/features/maps";
import type { MatchDto as Match } from "@/shared/api-types";
import { ApiError } from "@/shared/http";
import { useI18n } from "@/shared/i18n";
import { loadMe, useAccount } from "@/shared/session";
import { useCoachApi } from "../api/context";
import type { ReviewResponse } from "../api/coach.api";
import { normalizeCoaching, type CoachReview } from "../model/coaching";
import {
  buildMatchCards,
  buildRoster,
  defaultPlayer,
  savedReview,
  type AnalysisLike,
} from "../model/session";

export type ActiveReview = {
  id: string;
  coaching: CoachReview;
  rating: number | null;
  createdAt: string | null;
  /** true when written just now, false when reopened from history. */
  fresh: boolean;
  personalization?: ReviewResponse["personalization"];
};
export type Failure = { message: string; code?: string };

function readUrl() {
  if (typeof window === "undefined") return { match: null, player: null };
  const q = new URLSearchParams(window.location.search);
  return { match: q.get("match"), player: q.get("player") };
}
function writeUrl(match: string | null, player: string | null) {
  const q = new URLSearchParams();
  if (match) q.set("match", match);
  if (player) q.set("player", player);
  const s = q.toString();
  window.history.replaceState(null, "", s ? `/coach?${s}` : "/coach");
}

/**
 * State machine of the AI Coach screen:
 * pick a match → pick a player → (saved review | run) → report.
 * Every "run" is one real AI request; reopening a stored review costs nothing.
 */
export function useCoachSession() {
  const { t, lang } = useI18n();
  const { account } = useAccount();
  const { refresh } = useUsage();
  const upgrade = useUpgrade();
  const api = useCoachApi();
  const maps = useMapsApi();
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisLike | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [review, setReview] = useState<ActiveReview | null>(null);
  const [running, setRunning] = useState<number | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [loadError, setLoadError] = useState("");
  const wanted = useRef(readUrl());
  const seq = useRef(0);

  useEffect(() => {
    api
      .listMatches()
      .then(setMatches)
      .catch((e: unknown) => {
        setMatches([]);
        setLoadError(e instanceof Error ? e.message : "Request failed.");
      });
    maps
      .getProgress()
      .then(setProgress)
      .catch(() => setProgress(null));
  }, [api, maps]);

  const cards = useMemo(
    () => buildMatchCards(matches ?? [], progress),
    [matches, progress],
  );
  // Preselect the match from the URL (?match= accepts a match or analysis id).
  useEffect(() => {
    const w = wanted.current.match;
    if (!w || matchId || !cards.length) return;
    const hit = cards.find((c) => c.matchId === w || c.analysisId === w);
    if (hit) setMatchId(hit.matchId);
    wanted.current.match = null;
  }, [cards, matchId]);

  const card = cards.find((c) => c.matchId === matchId) ?? null;
  const analysisId = card?.analysisId ?? null;
  useEffect(() => {
    setAnalysis(null);
    setAnalysisError("");
    if (!analysisId) return;
    let alive = true;
    api
      .getAnalysis(analysisId)
      .then((a) => alive && setAnalysis(a))
      .catch(
        (e: unknown) =>
          alive &&
          setAnalysisError(e instanceof Error ? e.message : "Request failed."),
      );
    return () => {
      alive = false;
    };
  }, [api, analysisId]);

  const roster = useMemo(
    () =>
      analysis
        ? buildRoster(analysis, account?.steamId, loadMe(), (n) =>
            t("Player {n}", { n }),
          )
        : [],
    [analysis, account?.steamId, t],
  );
  // Default player once the roster is known: URL → account → "This is me".
  useEffect(() => {
    if (!roster.length || playerId) return;
    const pick = defaultPlayer(roster, wanted.current.player);
    wanted.current.player = null;
    if (pick) setPlayerId(pick);
  }, [roster, playerId]);

  // Reopen the stored review for this match/player when there is one.
  useEffect(() => {
    if (!analysisId || !playerId || running) return;
    const saved = savedReview(progress, analysisId, playerId);
    setReview((current) =>
      current?.fresh ? current : saved ? { ...saved, fresh: false } : null,
    );
  }, [analysisId, playerId, progress, running]);

  useEffect(() => {
    if (matches === null) return;
    writeUrl(matchId, playerId);
  }, [matches, matchId, playerId]);

  const pickMatch = useCallback((id: string | null) => {
    seq.current++;
    setMatchId(id);
    setPlayerId(null);
    setReview(null);
    setFailure(null);
    setRunning(null);
  }, []);
  const pickPlayer = useCallback((id: string | null) => {
    seq.current++;
    setPlayerId(id);
    setReview(null);
    setFailure(null);
    setRunning(null);
  }, []);

  const run = useCallback(() => {
    if (!analysisId || !playerId) return;
    const id = ++seq.current;
    setRunning(Date.now());
    setFailure(null);
    api
      .requestReview(analysisId, playerId, lang)
      .then((r) => {
        if (seq.current !== id) return;
        const next: ActiveReview = {
          id: r.reviewId,
          coaching: normalizeCoaching(r.coaching),
          rating: null,
          createdAt: new Date().toISOString(),
          fresh: true,
          ...(r.personalization ? { personalization: r.personalization } : {}),
        };
        setReview(next);
        // Keep the "reviewed" badges and the dashboard plan in sync.
        maps
          .getProgress()
          .then(setProgress)
          .catch(() => undefined);
      })
      .catch((e: unknown) => {
        if (seq.current !== id) return;
        if (upgrade.handle(e)) return;
        setFailure(
          e instanceof ApiError
            ? { message: e.message, ...(e.code ? { code: e.code } : {}) }
            : { message: e instanceof Error ? e.message : "Request failed." },
        );
      })
      .finally(() => {
        if (seq.current !== id) return;
        setRunning(null);
        void refresh();
      });
  }, [api, maps, analysisId, playerId, lang, upgrade, refresh]);

  const rate = useCallback(
    (value: number) => {
      if (!review) return;
      setReview({ ...review, rating: value });
      api
        .rateReview(review.id, value)
        .catch(() => setReview((r) => (r ? { ...r, rating: null } : r)));
    },
    [api, review],
  );

  return {
    loading: matches === null,
    loadError,
    cards,
    card,
    analysis,
    analysisError,
    roster,
    player: roster.find((r) => r.steamId === playerId) ?? null,
    review,
    running,
    failure,
    pickMatch,
    pickPlayer,
    run,
    rate,
  };
}
export type CoachSession = ReturnType<typeof useCoachSession>;
