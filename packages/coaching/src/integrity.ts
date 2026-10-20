/**
 * Fair coaching around unusual opponents. `analysis.integrity` (computed by the platform from
 * statistical signals and later bans) flags opponents; deaths to an opponent with level "high"
 * or banned after the match are not counted against the coached player: they are removed from
 * the events the review sees, the player's metrics and facts are recomputed without them, and
 * one neutral caveat is added. The model never learns who, why or which signals: it only gets
 * a boolean per round (`opponentFlagged`) and a count.
 */
import { COACH_CAVEATS } from "./languages.js";
import { z } from "zod";
import type { Analysis, Evidence } from "@cs2/contracts";

const id = z.string().min(1).max(128);
/** Lenient reader of analysis.integrity (unknown or malformed → no flags). */
export const integrityInputSchema = z.object({
  players: z
    .array(
      z
        .object({
          steamId: id,
          level: z.enum(["none", "low", "elevated", "high"]),
        })
        .passthrough(),
    )
    .max(128)
    .default([]),
  bannedAfterMatch: z
    .array(
      z
        .object({ steamId: id, bannedAfterMatch: z.boolean().optional() })
        .passthrough(),
    )
    .max(128)
    .default([]),
});
export type IntegrityInput = z.infer<typeof integrityInputSchema>;

/** Steam ids whose kills are not held against anyone (level "high" or banned after the match). */
export function flaggedOpponents(integrity: unknown): Set<string> {
  const parsed = integrityInputSchema.safeParse(integrity ?? {});
  if (!parsed.success) return new Set();
  return new Set([
    ...parsed.data.players
      .filter((p) => p.level === "high")
      .map((p) => p.steamId),
    ...parsed.data.bannedAfterMatch
      .filter((p) => p.bannedAfterMatch !== false)
      .map((p) => p.steamId),
  ]);
}
/** analysis.integrity from a stored (unparsed) analysis document. */
export const integrityOf = (raw: unknown): unknown =>
  raw && typeof raw === "object"
    ? (raw as { integrity?: unknown }).integrity
    : undefined;

/** The neutral caveat about excluded deaths, in every output language. */
export const UNUSUAL_OPPONENT_CAVEAT = COACH_CAVEATS.unusualOpponent;

export type FairResult = {
  analysis: Analysis;
  /** Kill events (the player's deaths) left out. */
  excluded: string[];
  /** Rounds where such a death happened. */
  rounds: Set<number>;
};

type Kill = Extract<NonNullable<Analysis["events"]>[number], { type: "kill" }>;
type Metric = Analysis["players"][number]["kills"];

const PERCENT = new Set([
  "traded-deaths",
  "kast",
  "survival",
  "opening-success",
]);

function recompute(m: Metric, num: number, den: number, kind: string): Metric {
  const numerator = Math.max(0, num);
  const denominator = Math.max(0, den);
  const scale = PERCENT.has(kind) ? 100 : 1;
  return {
    ...m,
    numerator,
    denominator,
    value:
      m.complete && denominator > 0
        ? Math.round(((scale * numerator) / denominator) * 100) / 100
        : m.complete
          ? null
          : m.value,
  };
}

/**
 * The analysis as the coached player's review should see it: their deaths to flagged opponents
 * removed from the events and from their deaths, survival, KAST, traded-deaths, opening and
 * early-death metrics (evidence values updated to match). Other players are unchanged.
 */
export function fairAnalysis(
  analysis: Analysis,
  steamId: string,
  flagged: Set<string>,
): FairResult {
  const none = { analysis, excluded: [], rounds: new Set<number>() };
  if (!flagged.size || flagged.has(steamId)) return none;
  const deaths = (analysis.events ?? []).filter(
    (e): e is Kill =>
      e.type === "kill" &&
      e.victimId === steamId &&
      !!e.attackerId &&
      flagged.has(e.attackerId),
  );
  if (!deaths.length) return none;
  const ids = new Set(deaths.map((d) => d.id));
  const rounds = new Set(deaths.map((d) => d.round));
  const player = analysis.players.find((p) => p.steamId === steamId);
  if (!player) return none;
  const rows = player.rounds ?? [];
  const hit = rows.filter((r) => rounds.has(r.round) && r.died);
  const n = deaths.length;
  const kastGain = hit.filter(
    (r) => !(r.kills > 0 || r.damageAssist || r.traded),
  ).length;
  const openingDeaths = hit.filter((r) => r.opening === "death").length;
  const tradedLost = hit.filter((r) => r.traded).length;
  const early = deaths.filter(
    (d) => typeof d.roundTime === "number" && d.roundTime <= 20,
  ).length;
  const adv = { ...(player.advanced ?? {}) };
  const change = (
    kind: string,
    num: (m: Metric) => number,
    den: (m: Metric) => number,
  ) => {
    const m = adv[kind];
    if (m) adv[kind] = recompute(m, num(m), den(m), kind);
  };
  change(
    "survival",
    (m) => m.numerator + n,
    (m) => m.denominator,
  );
  change(
    "kast",
    (m) => m.numerator + kastGain,
    (m) => m.denominator,
  );
  change(
    "traded-deaths",
    (m) => m.numerator - tradedLost,
    (m) => m.denominator - n,
  );
  change(
    "opening-deaths",
    (m) => m.numerator - openingDeaths,
    () => 1,
  );
  change(
    "opening-success",
    (m) => m.numerator,
    (m) => m.denominator - openingDeaths,
  );
  change(
    "early-deaths",
    (m) => m.numerator - early,
    () => 1,
  );
  const deathsMetric = recompute(
    player.deaths,
    player.deaths.numerator - n,
    1,
    "deaths",
  );
  const adjusted = {
    ...player,
    deaths: deathsMetric,
    advanced: adv,
    rounds: rows.map((r) =>
      rounds.has(r.round) && r.died
        ? {
            ...r,
            died: false,
            traded: false,
            ...(r.opening === "death" ? { opening: undefined } : {}),
          }
        : r,
    ),
  };
  const byEvidence = new Map<string, Metric>();
  for (const m of [deathsMetric, ...Object.values(adv)])
    for (const e of m.evidenceIds) byEvidence.set(e, m);
  const evidence: Evidence[] = analysis.evidence.map((e) => {
    const m = byEvidence.get(e.id);
    if (!m || !m.evidenceIds.includes(e.id)) return e;
    const rest = { ...e, eventIds: e.eventIds.filter((x) => !ids.has(x)) };
    delete rest.value;
    return {
      ...rest,
      description: `${e.kind}: ${m.numerator} / ${m.denominator}; complete=${m.complete}`,
      ...(m.value !== null ? { value: m.value } : {}),
    };
  });
  return {
    analysis: {
      ...analysis,
      events: (analysis.events ?? []).filter((e) => !ids.has(e.id)),
      players: analysis.players.map((p) =>
        p.steamId === steamId ? adjusted : p,
      ),
      evidence,
    },
    excluded: [...ids],
    rounds,
  };
}
