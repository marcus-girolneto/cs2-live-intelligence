import { learnProfile } from "@cs2/coaching";
import type { CoachPlansService } from "./coach-plans.service.js";
import type { AnalysisHistory } from "./coaching.ports.js";
import type { CoachingRepository } from "./coaching.repository.js";
import {
  validAnalyses,
  type ParsedAnalysis,
} from "./personalization.service.js";
import type { ViewerPolicy } from "./viewer.policy.js";

/** One match of GET /v1/coach/progress `timeline`. */
export type ProgressPoint = {
  analysisId: string;
  filename: string;
  date: string;
  map: string | null;
  rounds: number | null;
  /** Final score from the coached player's team view; null when any round lacks a result. */
  roundsWon: number | null;
  roundsLost: number | null;
  adr: number | null;
  kills: number | null;
  deaths: number | null;
  headshotPercentage: number | null;
  kast: number | null;
  openingSuccess: number | null;
  tradedDeaths: number | null;
};

type Metric = { complete: boolean; value: number | null } | undefined;
/** A metric's value only when complete and finite (absent data is never shown as zero). */
const value = (m: Metric): number | null =>
  m?.complete && m.value !== null && Number.isFinite(m.value) ? m.value : null;

type Rounds = { won?: boolean }[] | undefined;
/** Rounds won/lost by the player's team, only when every round has a known result. */
export function teamScore(rounds: Rounds): {
  roundsWon: number | null;
  roundsLost: number | null;
} {
  if (!rounds?.length || rounds.some((r) => r.won === undefined))
    return { roundsWon: null, roundsLost: null };
  const won = rounds.filter((r) => r.won).length;
  return { roundsWon: won, roundsLost: rounds.length - won };
}

/** Oldest-first per-match metrics of the coached player. */
export function progressTimeline(
  analyses: ParsedAnalysis[],
  steamId: string,
): ProgressPoint[] {
  return analyses
    .map((a) => ({
      a,
      p: a.analysis.players.find((x) => x.steamId === steamId),
    }))
    .filter((x) => !!x.p)
    .map(({ a, p }) => ({
      analysisId: a.id,
      filename: a.filename,
      date: a.createdAt,
      map: a.analysis.map ?? null,
      rounds: p!.rounds?.length ?? null,
      ...teamScore(p!.rounds),
      adr: value(p!.adr),
      kills: value(p!.kills),
      deaths: value(p!.deaths),
      headshotPercentage: value(p!.headshotPercentage),
      kast: value(p!.advanced?.kast),
      openingSuccess: value(p!.advanced?.["opening-success"]),
      tradedDeaths: value(p!.advanced?.["traded-deaths"]),
    }))
    .reverse();
}

/** GET /v1/coach/progress: timeline, learned profile, reviews, live calls and per-map tabs. */
export class ProgressService {
  constructor(
    private readonly coaching: CoachingRepository,
    private readonly history: AnalysisHistory,
    private readonly plans: CoachPlansService,
  ) {}

  async progress(
    ownerId: string,
    viewer: ViewerPolicy,
  ): Promise<Record<string, unknown>> {
    const profile = await this.coaching.profile(ownerId);
    const steamId = profile.playerSteamId;
    const analyses = await validAnalyses(this.history, ownerId);
    const reviews = (await this.coaching.reviews(ownerId)).map((r) =>
      viewer.review(r),
    );
    const liveCalls = (await this.coaching.liveCalls(ownerId)).map((c) =>
      viewer.liveCall(c),
    );
    const learned = steamId ? learnProfile(analyses, steamId) : null;
    return {
      playerSteamId: steamId,
      linkedToSteam: profile.linkedToSteam,
      analyzedMatches: analyses.length,
      profile: learned,
      timeline: steamId ? progressTimeline(analyses, steamId) : [],
      reviews,
      liveCalls,
      ...(await this.plans.progressByMap(ownerId, steamId, learned)),
    };
  }
}
