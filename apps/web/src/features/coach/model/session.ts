/**
 * Pure selectors for the /coach flow: match cards, roster, default player, saved reviews and
 * evidence rounds. No React, no fetching.
 */
import type { DemoEvent } from "@cs2/contracts";
import { finite, text } from "@/shared/format";
import type { Progress } from "@/features/maps";
import type { MatchDto } from "@/shared/api-types";
import type { Me } from "@/shared/session";
import { normalizeCoaching, type CoachReview } from "./coaching";

export type AnalysisLike = {
  id: string;
  analysis: {
    map?: string;
    roundOutcomes?: { round: number; winner?: "CT" | "T" }[];
    events?: DemoEvent[];
    evidence: { id: string; eventIds?: string[] }[];
    players: {
      steamId: string;
      name?: string;
      kills?: { value: number | null; complete: boolean };
      deaths?: { value: number | null; complete: boolean };
      adr?: { value: number | null; complete: boolean };
      rounds?: { side?: "CT" | "T" }[];
    }[];
  };
};

export type MatchCardModel = {
  matchId: string;
  analysisId: string;
  filename: string;
  date: string;
  map: string | null;
  kills: number | null;
  deaths: number | null;
  adr: number | null;
  rounds: number | null;
  score: { ct: number; t: number } | null;
  reviewed: boolean;
};

export function buildMatchCards(
  matches: MatchDto[],
  progress: Progress | null,
): MatchCardModel[] {
  const timeline = new Map(
    (progress?.timeline ?? []).map((e) => [e.analysisId, e]),
  );
  const reviewed = new Set((progress?.reviews ?? []).map((r) => r.analysisId));
  return matches
    .filter((m) => m.status === "complete" && m.analysisId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((m) => {
      const e = timeline.get(m.analysisId!);
      const raw = e as Record<string, unknown> | undefined;
      const ct = finite(raw?.scoreCt ?? (raw?.score as { ct?: unknown })?.ct);
      const t = finite(raw?.scoreT ?? (raw?.score as { t?: unknown })?.t);
      return {
        matchId: m.id,
        analysisId: m.analysisId!,
        filename: m.filename,
        date: m.createdAt,
        map: text(e?.map),
        kills: finite(e?.kills),
        deaths: finite(e?.deaths),
        adr: finite(e?.adr),
        rounds: finite(e?.rounds),
        score: ct !== null && t !== null ? { ct, t } : null,
        reviewed: reviewed.has(m.analysisId!),
      };
    });
}

export type RosterEntry = {
  steamId: string;
  name: string;
  team: "CT" | "T" | null;
  kills: number | null;
  deaths: number | null;
  adr: number | null;
  isYou: boolean;
};
const value = (m?: { value: number | null; complete: boolean }) =>
  m?.complete ? finite(m.value) : null;

export function buildRoster(
  a: AnalysisLike,
  accountSteamId: string | undefined,
  me: Me | null,
  fallbackName: (n: number) => string,
): RosterEntry[] {
  return a.analysis.players
    .filter((p) => text(p.steamId))
    .map((p, i) => {
      const sides = { CT: 0, T: 0 };
      for (const r of p.rounds ?? []) if (r.side) sides[r.side]++;
      return {
        steamId: p.steamId,
        name: text(p.name) ?? fallbackName(i + 1),
        team: sides.CT || sides.T ? (sides.CT >= sides.T ? "CT" : "T") : null,
        kills: value(p.kills),
        deaths: value(p.deaths),
        adr: value(p.adr),
        isYou:
          p.steamId === accountSteamId ||
          (me?.analysisId === a.id && me.steamId === p.steamId),
      } as RosterEntry;
    })
    .sort((x, y) => (y.adr ?? -1) - (x.adr ?? -1));
}

/** Account SteamID → "This is me" choice → (none; the user picks). */
export function defaultPlayer(
  roster: RosterEntry[],
  wanted: string | null,
): string | null {
  if (wanted && roster.some((r) => r.steamId === wanted)) return wanted;
  return roster.find((r) => r.isYou)?.steamId ?? null;
}

export type SavedReview = {
  id: string;
  createdAt: string;
  rating: number | null;
  coaching: CoachReview;
};
/** The newest stored review of this player in this match (opening it costs nothing). */
export function savedReview(
  progress: Progress | null,
  analysisId: string,
  steamId: string,
): SavedReview | null {
  const r = (progress?.reviews ?? []).find(
    (x) =>
      x.analysisId === analysisId &&
      (x.steamId === undefined || x.steamId === steamId),
  );
  return r
    ? {
        id: r.id,
        createdAt: r.createdAt,
        rating: r.rating,
        coaching: normalizeCoaching(r.coaching),
      }
    : null;
}

/** Rounds that contain the events behind a set of evidence ids. */
export function evidenceRounds(
  evidenceIds: string[],
  a: AnalysisLike | null,
): number[] {
  if (!a) return [];
  const byId = new Map(
    a.analysis.evidence.map((e) => [e.id, e.eventIds ?? []]),
  );
  const roundOf = new Map(
    (a.analysis.events ?? []).map((e) => [e.id, e.round]),
  );
  const rounds = new Set<number>();
  for (const id of evidenceIds)
    for (const ev of byId.get(id) ?? []) {
      const r = roundOf.get(ev);
      if (r !== undefined) rounds.add(r);
    }
  return [...rounds].sort((x, y) => x - y);
}

/** Final score from round outcomes (wins per side). */
export function scoreOf(a: AnalysisLike | null) {
  const o = a?.analysis.roundOutcomes ?? [];
  if (!o.length) return null;
  return {
    ct: o.filter((r) => r.winner === "CT").length,
    t: o.filter((r) => r.winner === "T").length,
  };
}
