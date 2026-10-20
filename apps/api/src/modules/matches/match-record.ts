import type { Analysis } from "@cs2/contracts";

/** One row of match_players: the per-player numbers indexed queries need. */
export type MatchPlayerRow = {
  steamId: string;
  name: string | null;
  teamStart: "CT" | "T" | null;
  kills: number | null;
  deaths: number | null;
  /** Rounds with a damage assist (the "A" of KAST). */
  assists: number | null;
  adr: number | null;
  kast: number | null;
  hsPct: number | null;
  accuracy: number | null;
  tradedDeathsPct: number | null;
  openingWinPct: number | null;
  utilityDamagePerRound: number | null;
  roundsPlayed: number;
};

/** A parsed match as stored in `matches` (+ its players). The document lives in storage. */
export type MatchRecord = {
  id: string;
  checksum: string;
  parserVersion: string | null;
  map: string | null;
  tickRate: number | null;
  roundsCount: number;
  /** Rounds won by the team that started on CT / on T (null when unknown). */
  scoreCt: number | null;
  scoreT: number | null;
  /** Slim summary kept in Postgres (no players, evidence or events). */
  summary: Record<string, unknown>;
  coaching: unknown;
  analysisKey: string;
  eventsCount: number | null;
  players: MatchPlayerRow[];
};

type Player = Analysis["players"][number];
type Metric = Player["kills"] | undefined;

const value = (m: Metric): number | null =>
  m && m.complete && m.value !== null && Number.isFinite(m.value)
    ? Math.round(m.value * 100) / 100
    : null;

/** match_players row of one analysed player. */
export function playerRow(player: Player): MatchPlayerRow {
  const adv = player.advanced ?? {};
  const rounds = player.rounds ?? [];
  const side = rounds.find((r) => r.side)?.side ?? null;
  return {
    steamId: player.steamId,
    name: player.name?.slice(0, 128) ?? null,
    teamStart: side,
    kills: value(player.kills),
    deaths: value(player.deaths),
    assists: rounds.length ? rounds.filter((r) => r.damageAssist).length : null,
    adr: value(player.adr),
    kast: value(adv.kast),
    hsPct: value(player.headshotPercentage),
    accuracy: value(adv.accuracy),
    tradedDeathsPct: value(adv["traded-deaths"]),
    openingWinPct: value(adv["opening-success"]),
    utilityDamagePerRound: value(adv["utility-damage-per-round"]),
    roundsPlayed: rounds.length,
  };
}

/** Rounds won by the team that started on `side`, from its best-covered player. */
function teamScore(players: Player[], side: "CT" | "T"): number | null {
  let best: { rounds: number; won: number } | undefined;
  for (const p of players) {
    const rounds = p.rounds ?? [];
    if (!rounds.length || rounds.find((r) => r.side)?.side !== side) continue;
    if (rounds.some((r) => r.won === undefined)) continue;
    if (!best || rounds.length > best.rounds)
      best = { rounds: rounds.length, won: rounds.filter((r) => r.won).length };
  }
  return best?.won ?? null;
}

/** Columns and players of the `matches` row of an analysis (pure; unit-tested). */
export function matchRecord(input: {
  id: string;
  checksum: string;
  analysis: Analysis | Record<string, unknown>;
  coaching: unknown;
  tickRate?: number;
  analysisKey: string;
  eventsCount: number | null;
}): MatchRecord {
  const doc = input.analysis as Partial<Analysis>;
  const outcomes = Array.isArray(doc.roundOutcomes) ? doc.roundOutcomes : [];
  const players = Array.isArray(doc.players) ? doc.players : [];
  return {
    id: input.id,
    checksum: input.checksum,
    parserVersion: doc.provenance?.parserVersion ?? null,
    map: doc.map ?? null,
    tickRate: input.tickRate ?? null,
    roundsCount: outcomes.length,
    scoreCt: teamScore(players, "CT"),
    scoreT: teamScore(players, "T"),
    summary: {
      schemaVersion: doc.schemaVersion,
      source: doc.source,
      ...(doc.map ? { map: doc.map } : {}),
      ...(doc.provenance ? { provenance: doc.provenance } : {}),
      roundOutcomes: outcomes,
      caveats: Array.isArray(doc.caveats) ? doc.caveats : [],
    },
    coaching: input.coaching,
    analysisKey: input.analysisKey,
    eventsCount: input.eventsCount,
    players: [
      ...new Map(
        players
          .filter((p) => typeof p?.steamId === "string")
          .map((p) => [p.steamId, playerRow(p)]),
      ).values(),
    ],
  };
}
