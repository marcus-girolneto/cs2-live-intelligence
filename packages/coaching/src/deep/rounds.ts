/**
 * Deep module: the player's round-by-round table (buy, utility, damage, outcome and a
 * deterministic mistake/highlight tag), and the Pro history comparison against previous deep
 * reviews on the same map.
 */
import { onTargetPct } from "@cs2/contracts/crosshair";
import type { Analysis, DeepPositioning, DeepReview } from "@cs2/contracts";
import { mean, r1, uniqueGrenades, type Player } from "./common.js";

type Row = DeepReview["rounds"][number];
type Death = DeepPositioning["deathsDetail"][number];
type Chip = NonNullable<DeepReview["history"]>[number];

/** Deaths in the first 20 s of a round are "early". */
export const EARLY_DEATH_SECONDS = 20;

/**
 * Tag rules (first match wins):
 * - highlight: 2+ kills, a won clutch, or an opening kill in a won round;
 * - mistake: a death that was untraded, early (< 20 s) or without dealing damage;
 * - otherwise no tag.
 */
export function roundTable(
  analysis: Analysis,
  player: Player,
  deaths: Death[],
): Row[] {
  const grenades = uniqueGrenades(analysis).filter(
    (g) => g.throwerId === player.steamId,
  );
  const deathByRound = new Map(deaths.map((d) => [d.round, d]));
  const unused = new Map<number, number>();
  for (const e of analysis.events ?? [])
    if (
      e.type === "kill" &&
      e.victimId === player.steamId &&
      Array.isArray(e.victimGrenades)
    )
      unused.set(e.round, e.victimGrenades.length);
  return (player.rounds ?? []).slice(0, 60).map((r) => {
    const thrown = grenades.filter((g) => g.round === r.round).length;
    const death = deathByRound.get(r.round);
    const tags: string[] = [];
    if (r.kills >= 2) tags.push("multi_kill");
    if (r.clutchVs && r.won) tags.push("clutch_win");
    if (r.opening === "kill") tags.push("opening_kill");
    if (r.opening === "death") tags.push("opening_death");
    if (r.died && death && !death.traded) tags.push("untraded_death");
    if (
      r.died &&
      r.deathTime !== undefined &&
      r.deathTime < EARLY_DEATH_SECONDS
    )
      tags.push("early_death");
    if (r.died && r.damage === 0) tags.push("zero_damage");
    if (r.died && (unused.get(r.round) ?? 0) >= 2) tags.push("saved_utility");
    const highlight =
      r.kills >= 2 ||
      (!!r.clutchVs && r.won === true) ||
      (r.opening === "kill" && r.won === true);
    const mistake =
      r.died &&
      (tags.includes("untraded_death") ||
        tags.includes("early_death") ||
        tags.includes("zero_damage"));
    return {
      round: r.round,
      ...(r.side ? { side: r.side } : {}),
      ...(r.won !== undefined ? { won: r.won } : {}),
      ...(r.buyType ? { buy: r.buyType } : {}),
      ...(r.equipmentValue !== undefined
        ? { equipmentValue: r.equipmentValue }
        : {}),
      utilityThrown: thrown,
      kills: r.kills,
      damage: r.damage,
      died: r.died,
      ...(r.deathTime !== undefined ? { deathTime: r1(r.deathTime) } : {}),
      tag: highlight ? "highlight" : mistake ? "mistake" : null,
      tags: tags.slice(0, 6),
    };
  });
}

type Metric = {
  key: string;
  label: string;
  unit: string;
  better: "lower" | "higher";
  value: (d: DeepReview) => number | null | undefined;
};
/** Metrics compared against previous deep reviews on the same map. */
export const HISTORY_METRICS: Metric[] = [
  {
    key: "crosshair-on-target",
    label: "Duels with the crosshair already on the enemy",
    unit: "%",
    better: "higher",
    value: (d) => onTargetPct(d.crosshair?.samples ?? []),
  },
  {
    key: "enemies-per-flash",
    label: "Enemies blinded per flash",
    unit: "",
    better: "higher",
    value: (d) => d.utility?.stats.flash.enemiesPerFlash,
  },
  {
    key: "team-flash-rate",
    label: "Team-flash rate",
    unit: "%",
    better: "lower",
    value: (d) => d.utility?.stats.flash.teamFlashRate,
  },
  {
    key: "isolated-deaths",
    label: "Isolated deaths",
    unit: "%",
    better: "lower",
    value: (d) => d.positioning?.isolatedPct,
  },
  {
    key: "traded-deaths",
    label: "Deaths traded",
    unit: "%",
    better: "higher",
    value: (d) => d.positioning?.tradedPct,
  },
];

/** This review versus the mean of previous deep reviews (same map), per metric present in both. */
export function deepHistory(
  current: DeepReview,
  previous: DeepReview[],
): Chip[] {
  return HISTORY_METRICS.flatMap((m): Chip[] => {
    const now = m.value(current);
    const past = previous
      .map(m.value)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (typeof now !== "number" || !past.length) return [];
    return [
      {
        key: m.key,
        label: m.label,
        current: now,
        baseline: r1(mean(past)!),
        unit: m.unit,
        better: m.better,
        matches: past.length,
      },
    ];
  });
}
