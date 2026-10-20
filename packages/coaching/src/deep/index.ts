/**
 * Deep review: runs the deterministic modules (utility, crosshair, positioning, rounds) for one
 * player and returns the contract object plus the citable facts the model may reference.
 */
import type { Analysis, DeepReview, Evidence } from "@cs2/contracts";
import { CalloutIndex, ReplayIndex, type DeepReplay } from "./common.js";
import { crosshairModule } from "./crosshair.js";
import { meters } from "./positioning.js";
import { positioningModule } from "./positioning.js";
import { deepHistory, roundTable } from "./rounds.js";
import { utilityModule } from "./utility.js";

export type { DeepReplay } from "./common.js";
export { aimOffset, duelStarts, measureDuels, wrap } from "./crosshair.js";
export { deathFacts } from "./positioning.js";
export { deepHistory, HISTORY_METRICS, roundTable } from "./rounds.js";
export { uniqueGrenades } from "./common.js";
export { utilityLog } from "./utility.js";

export type DeepResult = { deep: DeepReview; evidence: Evidence[] };

/**
 * All deep modules for `steamId`. `replay` adds isolation, hold time, throw origins and
 * crosshair placement (the latter needs parser cs2live.3 samples); `previous` are earlier deep
 * reviews of this player on the same map (Pro history comparison).
 */
export function computeDeep(
  analysis: Analysis,
  steamId: string,
  replay?: DeepReplay,
  previous: DeepReview[] = [],
): DeepResult {
  const player = analysis.players.find((p) => p.steamId === steamId);
  if (!player) throw new Error("Unknown player");
  const replays = new ReplayIndex(replay);
  const callouts = new CalloutIndex(analysis);
  const caveats: string[] = [];
  const utility = utilityModule(analysis, steamId, replays, callouts);
  const crosshair = crosshairModule(analysis, steamId, replays, callouts);
  const positioning = positioningModule(analysis, player, replays);
  if (!replays.available)
    caveats.push(
      "No replay samples are stored for this match: crosshair placement, isolation and hold times are unavailable.",
    );
  else if (!crosshair)
    caveats.push(
      "This match was processed before view pitch and height were recorded; reprocess it to measure crosshair placement.",
    );
  if (!utility.utility.unusedAtDeath)
    caveats.push(
      "Inventories at death are not in this demo's data, so unused utility is not measured.",
    );
  caveats.push(
    "Molotov area-denial time is not derivable from the demo; landing callouts are the nearest callout seen in this match.",
  );
  const deep: DeepReview = {
    utility: utility.utility,
    ...(crosshair ? { crosshair: crosshair.crosshair } : {}),
    positioning: positioning.positioning,
    rounds: roundTable(analysis, player, positioning.positioning.deathsDetail),
    caveats: caveats.slice(0, 10),
  };
  const history = previous.length ? deepHistory(deep, previous) : [];
  if (history.length) deep.history = history;
  return {
    deep,
    evidence: [
      ...utility.evidence,
      ...(crosshair?.evidence ?? []),
      ...positioning.evidence,
    ],
  };
}

/** Compact, model-facing view of the deep modules (logs and per-sample lists trimmed). */
export function deepContext(deep: DeepReview) {
  const u = deep.utility;
  const c = deep.crosshair;
  const p = deep.positioning;
  return {
    ...(u
      ? {
          utility: {
            thrown: u.thrown,
            perType: u.perType,
            stats: u.stats,
            ...(u.unusedAtDeath ? { unusedAtDeath: u.unusedAtDeath } : {}),
            grenades: u.grenades.slice(0, 40).map((g) => ({
              round: g.round,
              time: g.time,
              type: g.type,
              fromPlace: g.fromPlace,
              landingPlace: g.landingPlace,
              enemiesFlashed: g.enemiesFlashed,
              teammatesFlashed: g.teammatesFlashed,
              damage: g.damage,
              verdict: g.verdict,
            })),
            lineups: u.lineups.map((l) => ({
              kind: l.kind,
              title: l.title,
              type: l.type,
              place: l.place,
              fromPlace: l.fromPlace,
              count: l.count,
              why: l.why,
            })),
          },
        }
      : {}),
    ...(c
      ? {
          // No angles: the model talks about the crosshair the way players do.
          crosshair: {
            duels: c.duels,
            measured: c.measured,
            ...(c.preAim ? { preAim: c.preAim } : {}),
            typicalHeight: c.heightBand ?? null,
            sideDrift: c.horizontalBias ?? null,
            worstCallouts: (c.perCallout ?? []).map((w) => ({
              place: w.callout,
              duels: w.total,
              crosshairNotOnEnemy: w.total - w.onTarget,
            })),
          },
        }
      : {}),
    ...(p
      ? {
          // Distances in meters (stored in world units).
          positioning: {
            deaths: p.deaths,
            avgIsolationMeters:
              p.avgIsolation === null ? null : meters(p.avgIsolation),
            isolatedPct: p.isolatedPct,
            tradedPct: p.tradedPct,
            crossfirePct: p.crossfirePct,
            avgHoldSeconds: p.avgHoldSeconds,
            byCallout: p.byCallout.map(({ avgIsolation, ...c }) => ({
              ...c,
              avgIsolationMeters:
                avgIsolation === null ? null : meters(avgIsolation),
            })),
            dangerZones: p.dangerZones.map((z) => ({
              place: z.place,
              deaths: z.deaths,
              rounds: z.rounds,
              why: z.why,
            })),
            deathsDetail: p.deathsDetail.map(({ nearestTeammate, ...d }) => ({
              ...d,
              nearestTeammateMeters:
                nearestTeammate === null ? null : meters(nearestTeammate),
            })),
          },
        }
      : {}),
    rounds: deep.rounds,
    ...(deep.history?.length ? { history: deep.history } : {}),
    caveats: deep.caveats,
  };
}
