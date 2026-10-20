"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCredits, useUpgrade, useUsage } from "@/features/billing";
import { useMapsApi, type Progress } from "@/features/maps";
import type { MatchDto as Match } from "@/shared/api-types";
import { ApiError, aiErrorText } from "@/shared/http";
import { useI18n } from "@/shared/i18n";
import { loadMe, useAccount } from "@/shared/session";
import { useCoachApi } from "../api/context";
import type { ReviewResponse } from "../api/coach.api";
import {
  normalizeCoaching,
  type CoachReview,
  type ReviewTier,
} from "../model/coaching";
import {
  buildMatchCards,
  buildRoster,
  defaultPlayer,
  type AnalysisLike,
} from "../model/session";
import { usePlayerReviews } from "./usePlayerReviews";

export type ActiveReview = {
  id: string;
  tier: ReviewTier;
  coaching: CoachReview;
  rating: number | null;
  createdAt: string | null;
  /** true when written just now, false when reopened from history. */
  fresh: boolean;
  personalization?: ReviewResponse["personalization"];
};
export type Failure = { message: string; code?: string; tier: ReviewTier };

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
 * pick a match → pick a player → choose a tier (Quick | Deep) → report (⇄ compare).
 * Every "run" is one real AI request paid in credits; reopening a stored review is free.
 */
export function useCoachSession() {
  const { t, lang } = useI18n();
  const { account } = useAccount();
  const { refresh } = useUsage();
  const credits = useCredits();
  const upgrade = useUpgrade();
  const api = useCoachApi();
  const maps = useMapsApi();
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisLike | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [shown, setShown] = useState<ReviewTier | "choose" | null>(null);
  const [ratings, setRatings] = useState<Record<string, number | null>>({});
  const [running, setRunning] = useState<{
    since: number;
    tier: ReviewTier;
  } | null>(null);
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

  const reviews = usePlayerReviews(analysisId, playerId, progress);
  const byTier = reviews.byTier;
  // Which screen: an explicit choice wins, else the newest stored review, else the tiers.
  const latest: ReviewTier | null = byTier
    ? byTier.deep && byTier.quick
      ? Date.parse(byTier.deep.createdAt) >= Date.parse(byTier.quick.createdAt)
        ? "deep"
        : "quick"
      : byTier.deep
        ? "deep"
        : byTier.quick
          ? "quick"
          : null
    : null;
  const view = shown ?? latest ?? "choose";
  const pickedReview = view === "choose" ? null : (byTier?.[view] ?? null);
  const review: ActiveReview | null = pickedReview
    ? {
        id: pickedReview.id,
        tier: pickedReview.tier,
        coaching: pickedReview.coaching,
        rating: ratings[pickedReview.id] ?? pickedReview.rating,
        createdAt: pickedReview.createdAt,
        fresh: !!pickedReview.fresh,
      }
    : null;

  useEffect(() => {
    if (matches === null) return;
    writeUrl(matchId, playerId);
  }, [matches, matchId, playerId]);

  const pickMatch = useCallback((id: string | null) => {
    seq.current++;
    setMatchId(id);
    setPlayerId(null);
    setShown(null);
    setFailure(null);
    setRunning(null);
  }, []);
  const pickPlayer = useCallback((id: string | null) => {
    seq.current++;
    setPlayerId(id);
    setShown(null);
    setFailure(null);
    setRunning(null);
  }, []);
  /** Back to the tier cards (e.g. "Ask again" or "Run a Deep review"). */
  const choose = useCallback(() => {
    setFailure(null);
    setShown("choose");
  }, []);
  /** Open the stored review of a tier (free). */
  const open = useCallback((tier: ReviewTier) => setShown(tier), []);

  const add = reviews.add;
  const run = useCallback(
    (tier: ReviewTier) => {
      if (!analysisId || !playerId) return;
      // Not enough credits: offer packs/plans instead of a failing request.
      if (!credits.canAfford(tier)) {
        upgrade.openCredits({
          needed: credits.cost(tier),
          balance: credits.balance,
          tier,
        });
        return;
      }
      const id = ++seq.current;
      setRunning({ since: Date.now(), tier });
      setFailure(null);
      api
        .requestReview(analysisId, playerId, lang, tier)
        .then((r) => {
          if (seq.current !== id) return;
          const coaching = normalizeCoaching(r.coaching);
          add({
            id: r.reviewId,
            tier,
            coaching: { ...coaching, tier },
            rating: null,
            createdAt: new Date().toISOString(),
            fresh: true,
          });
          setShown(tier);
          // Keep the "reviewed" badges and the dashboard plan in sync.
          maps
            .getProgress()
            .then(setProgress)
            .catch(() => undefined);
        })
        .catch((e: unknown) => {
          if (seq.current !== id) return;
          if (upgrade.handle(e)) return;
          setFailure({
            message: aiErrorText(e, "review"),
            tier,
            ...(e instanceof ApiError && e.code ? { code: e.code } : {}),
          });
        })
        .finally(() => {
          if (seq.current !== id) return;
          setRunning(null);
          void refresh();
        });
    },
    [api, maps, analysisId, playerId, lang, upgrade, refresh, credits, add],
  );

  const reviewId = review?.id;
  const rate = useCallback(
    (value: number) => {
      if (!reviewId) return;
      setRatings((r) => ({ ...r, [reviewId]: value }));
      api
        .rateReview(reviewId, value)
        .catch(() => setRatings((r) => ({ ...r, [reviewId]: null })));
    },
    [api, reviewId],
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
    /** Latest stored review per tier (null while loading). */
    byTier,
    view,
    running,
    failure,
    pickMatch,
    pickPlayer,
    choose,
    open,
    run,
    rate,
  };
}
export type CoachSession = ReturnType<typeof useCoachSession>;
