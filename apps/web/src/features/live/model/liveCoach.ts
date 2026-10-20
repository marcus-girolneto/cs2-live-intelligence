import type { LiveState } from "@cs2/contracts";
import { finite } from "@/shared/format";

/** One completed round as seen from the player's own GSI snapshots. */
export type RoundRecord = {
  round: number;
  kills: number;
  died: boolean;
  won?: boolean;
  armorAtStart?: number;
};
export type Baseline = {
  label: string;
  kd: number | null;
  killsPerRound: number | null;
};
export type CoachTip = {
  id: string;
  tone: "warn" | "good" | "info";
  text: string;
  vars?: Record<string, string | number>;
};

export type RoundTracker = {
  current?: {
    round: number;
    kills0: number | null;
    deaths0: number | null;
    kills: number | null;
    deaths: number | null;
    armorAtStart?: number;
  };
  rounds: RoundRecord[];
  finished: boolean;
};
export const emptyTracker = (): RoundTracker => ({
  rounds: [],
  finished: false,
});

/**
 * Folds own-player snapshots into per-round records, closing a round when the round
 * counter advances or the match ends. Rounds without visible kill/death counts are
 * skipped rather than guessed.
 */
export function trackRound(
  tracker: RoundTracker,
  state: LiveState,
): RoundTracker {
  const round = finite(state.round);
  if (round === null || tracker.finished) return tracker;
  const kills = finite(state.ownStats?.kills);
  const deaths = finite(state.ownStats?.deaths);
  const armor = finite(state.ownStats?.armor);
  const open = (): RoundTracker["current"] => ({
    round,
    kills0: kills,
    deaths0: deaths,
    kills,
    deaths,
    ...(armor !== null ? { armorAtStart: armor } : {}),
  });
  const close = (c: NonNullable<RoundTracker["current"]>): RoundRecord[] =>
    c.kills0 === null ||
    c.deaths0 === null ||
    c.kills === null ||
    c.deaths === null
      ? tracker.rounds
      : [
          ...tracker.rounds,
          {
            round: c.round,
            kills: Math.max(0, c.kills - c.kills0),
            died: c.deaths > c.deaths0,
            ...(c.armorAtStart !== undefined
              ? { armorAtStart: c.armorAtStart }
              : {}),
          },
        ];
  const current = tracker.current;
  if (!current) return { ...tracker, current: open() };
  if (round > current.round)
    return { rounds: close(current), current: open(), finished: false };
  const updated = {
    ...current,
    kills: kills ?? current.kills,
    deaths: deaths ?? current.deaths,
  };
  if (state.phase === "gameover")
    return { rounds: close(updated), finished: true };
  return { ...tracker, current: updated };
}

export function baselineFrom(
  label: string,
  kills: number | null,
  deaths: number | null,
  rounds: number | null,
): Baseline {
  return {
    label,
    kd: kills !== null && deaths ? kills / deaths : null,
    killsPerRound: kills !== null && rounds ? kills / rounds : null,
  };
}

/**
 * Deterministic between-round coach from the player's own data. It never uses enemy
 * information and stays quiet during live action to avoid distracting the player.
 */
export function liveTips(
  state: LiveState | null,
  rounds: RoundRecord[],
  baseline: Baseline | null,
): CoachTip[] {
  if (!state) return [];
  const phase = state.phase;
  if (phase === "live")
    return [
      {
        id: "focus",
        tone: "info",
        text: "Round in progress. Tips show up between rounds.",
      },
    ];
  const tips: CoachTip[] = [];
  const last = rounds.slice(-3);
  if (last.length === 3 && last.every((r) => r.died))
    tips.push({
      id: "death-streak",
      tone: "warn",
      text: "You died in each of the last {n} rounds. Next round, stay next to a teammate so your death can be traded.",
      vars: { n: 3 },
    });
  const dry = rounds.slice(-4);
  if (dry.length === 4 && dry.every((r) => r.kills === 0))
    tips.push({
      id: "dry",
      tone: "warn",
      text: "No kills in the last {n} rounds. Look for an early-info position and fight with a teammate instead of taking first contact alone.",
      vars: { n: 4 },
    });
  const hot = rounds.slice(-2).reduce((n, r) => n + r.kills, 0);
  if (hot >= 3)
    tips.push({
      id: "hot",
      tone: "good",
      text: "{n} kills in the last two rounds. You're in form, keep taking the same kind of fights.",
      vars: { n: hot },
    });
  const armor = finite(state.ownStats?.armor);
  const round = finite(state.round);
  if (phase === "freezetime" && armor === 0 && round !== null && round > 0)
    tips.push({
      id: "no-armor",
      tone: "info",
      text: "No armor this round. Avoid long-range duels and play for trades or exit frags.",
    });
  const ct = finite(state.score?.ct);
  const t = finite(state.score?.t);
  if (ct !== null && t !== null && (ct === 12 || t === 12))
    tips.push({
      id: "match-point",
      tone: "info",
      text: "Match point. Play for your team's call and save utility for the decisive fight.",
    });
  const kills = finite(state.ownStats?.kills);
  const deaths = finite(state.ownStats?.deaths);
  if (
    baseline?.kd != null &&
    kills !== null &&
    deaths !== null &&
    kills + deaths >= 6
  ) {
    const kd = deaths === 0 ? kills : kills / deaths;
    if (kd >= baseline.kd * 1.2)
      tips.push({
        id: "above-baseline",
        tone: "good",
        text: "K/D {kd}, above your baseline of {base} ({label}).",
        vars: {
          kd: kd.toFixed(2),
          base: baseline.kd.toFixed(2),
          label: baseline.label,
        },
      });
    else if (kd <= baseline.kd * 0.8)
      tips.push({
        id: "below-baseline",
        tone: "warn",
        text: "K/D {kd}, below your baseline of {base} ({label}). Keep it simple: play a position you know and trade with your team.",
        vars: {
          kd: kd.toFixed(2),
          base: baseline.kd.toFixed(2),
          label: baseline.label,
        },
      });
  }
  if (!tips.length)
    tips.push({
      id: "steady",
      tone: "info",
      text: "Nothing to change right now. Keep communicating and stay in trade distance.",
    });
  return tips;
}
