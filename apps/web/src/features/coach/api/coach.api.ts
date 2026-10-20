import {
  normalizeTeamReview,
  normalizeTeamReviews,
  type StoredTeamReview,
} from "../model/team";
import type { MatchDto, MatchListDto } from "@/shared/api-types";
import { platformHttp, seg, type HttpClient } from "@/shared/http";
import { parseClip, type ClipRef } from "@/features/replay";
import { finite, text } from "@/shared/format";
import type { ReviewTier } from "../model/coaching";
import type { AnalysisLike } from "../model/session";

/** A real model call can take minutes; the API enforces its own timeout. */
const AI_TIMEOUT = 10 * 60 * 1000;

export type ReviewResponse = {
  reviewId: string;
  steamId?: string;
  coaching: unknown;
  creditsSpent?: number;
  balance?: number;
  personalization?: {
    preferences?: { style?: string; tone?: string; role?: string };
    learnedFromMatches?: number;
    previousPlans?: number;
  };
};

/** A stored review of one player in one match (any tier). */
export type StoredReview = {
  id: string;
  tier: ReviewTier | null;
  createdAt: string;
  coaching: unknown;
};
/** One clip of the match reel (highlights and mistakes, back to back). */
export type ReelMoment = {
  kills: number;
  opening: boolean;
  traded: boolean | null;
  weapon?: string;
  place?: string;
};
export type ReelClip = ClipRef & {
  kind: "highlight" | "mistake";
  moment?: ReelMoment;
};

/** Matches, analyses and AI reviews used by the /coach flow. */
export interface CoachApi {
  listMatches(): Promise<MatchDto[]>;
  /** Whether you played in this demo (null when unknown). */
  matchOwnership(matchId: string): Promise<"mine" | "external" | null>;
  getAnalysis(analysisId: string): Promise<AnalysisLike>;
  requestReview(
    analysisId: string,
    steamId: string,
    lang: string,
    tier?: ReviewTier,
  ): Promise<ReviewResponse>;
  /** Every stored review of this player in this match, newest first. */
  listReviews(analysisId: string, steamId: string): Promise<StoredReview[]>;
  /** Match reel clips (Pro). */
  getReel(analysisId: string, steamId: string): Promise<ReelClip[]>;
  rateReview(reviewId: string, rating: number): Promise<void>;
  /** Runs a team review (IGL view of your whole team; costs credits). */
  requestTeamReview(
    analysisId: string,
    steamId: string,
    lang: string,
  ): Promise<StoredTeamReview>;
  /** Stored team reviews for this player's team, newest first. */
  listTeamReviews(
    analysisId: string,
    steamId: string,
  ): Promise<StoredTeamReview[]>;
}

export function createCoachApi(http: HttpClient = platformHttp): CoachApi {
  return {
    listMatches: () =>
      http.get<MatchListDto>("matches").then((r) => r.matches ?? []),
    matchOwnership: async (matchId) => {
      const r = await http.get<{
        items?: { jobId?: unknown; ownership?: unknown }[];
      }>(`matches/ownership?ids=${encodeURIComponent(matchId)}`);
      const o = (r.items ?? []).find((i) => i.jobId === matchId)?.ownership;
      return o === "mine" || o === "external" ? o : null;
    },
    getAnalysis: (analysisId) =>
      http.get<AnalysisLike>(`analyses/${seg(analysisId)}`),
    requestReview: (analysisId, steamId, lang, tier = "quick") =>
      http.post<ReviewResponse>(
        `analyses/${seg(analysisId)}/coaching`,
        { steamId, lang, tier },
        { timeoutMs: AI_TIMEOUT },
      ),
    listReviews: async (analysisId, steamId) =>
      parseStoredReviews(
        await http.get<unknown>(`analyses/${seg(analysisId)}/reviews`, {
          query: { steamId },
        }),
      ),
    getReel: async (analysisId, steamId) =>
      parseReel(
        await http.get<unknown>(`analyses/${seg(analysisId)}/reel`, {
          query: { steamId },
        }),
      ),
    requestTeamReview: async (analysisId, steamId, lang) => {
      const r = await http.post<Record<string, unknown>>(
        `analyses/${seg(analysisId)}/team-review`,
        { steamId, lang },
        { timeoutMs: AI_TIMEOUT },
      );
      const review = normalizeTeamReview(r.teamReview);
      if (!review) throw new Error("The coach returned an unexpected answer.");
      return {
        id: typeof r.reviewId === "string" ? r.reviewId : "new",
        createdAt: new Date().toISOString(),
        review,
        fresh: true,
      };
    },
    listTeamReviews: async (analysisId, steamId) =>
      normalizeTeamReviews(
        await http.get<unknown>(`analyses/${seg(analysisId)}/team-reviews`, {
          query: { steamId },
        }),
      ),
    rateReview: async (reviewId, rating) => {
      await http.post(`coach/reviews/${seg(reviewId)}/rating`, { rating });
    },
  };
}
export const coachApi = createCoachApi();

const list = (raw: unknown, key: string): unknown[] => {
  const v = (raw as Record<string, unknown> | null)?.[key];
  return Array.isArray(v) ? v : [];
};
export function parseStoredReviews(raw: unknown): StoredReview[] {
  return list(raw, "reviews")
    .flatMap((r): StoredReview[] => {
      const o = r as Record<string, unknown> | null;
      const id = o && (text(o.reviewId) ?? text(o.id));
      const createdAt = o && text(o.createdAt);
      if (!o || !id || !createdAt) return [];
      const tier = o.tier === "quick" || o.tier === "deep" ? o.tier : null;
      return [{ id, tier, createdAt, coaching: o.coaching }];
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
export function parseReel(raw: unknown): ReelClip[] {
  return list(raw, "clips")
    .flatMap((c): ReelClip[] => {
      const o = c as Record<string, unknown> | null;
      const clip = parseClip(o);
      if (!o || !clip) return [];
      // `title`/`label` are English: the reel button writes a localized label from `moment`.
      const m =
        o.moment && typeof o.moment === "object"
          ? (o.moment as Record<string, unknown>)
          : null;
      const kills = m ? finite(m.kills) : null;
      const { label: _english, ...rest } = clip;
      void _english;
      return [
        {
          ...rest,
          kind: o.kind === "highlight" ? "highlight" : "mistake",
          ...(m
            ? {
                moment: {
                  kills: kills === null ? 0 : Math.max(0, Math.round(kills)),
                  opening: m.opening === true,
                  traded: typeof m.traded === "boolean" ? m.traded : null,
                  ...(text(m.weapon) ? { weapon: text(m.weapon)! } : {}),
                  ...(text(m.place) ? { place: text(m.place)! } : {}),
                },
              }
            : {}),
        },
      ];
    })
    .sort((a, b) => a.round - b.round || a.from - b.from)
    .slice(0, 30);
}
/** Balance after a review, when the API reports it. */
export const balanceAfter = (r: ReviewResponse) => finite(r.balance);
