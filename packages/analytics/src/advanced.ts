import type { DemoEvent, NormalizedDemo, PlayerRound } from "@cs2/contracts";

type Kill = Extract<DemoEvent, { type: "kill" }>;
type Damage = Extract<DemoEvent, { type: "damage" }>;
type Side = "CT" | "T";
/** CS2 matchmaking demos record 64 ticks per second; a trade is a revenge kill within 5 s. */
export const TRADE_TICKS = 5 * 64;

const half = (round: number) =>
  round <= 24 ? Math.ceil(round / 12) : 3 + Math.floor((round - 25) / 3);
const isSide = (team: unknown): team is Side => team === "CT" || team === "T";

/**
 * Resolves each participant's side per round from their own events, falling back to the
 * nearest round in the same half (sides only swap at half time). Unresolved stays undefined.
 */
export function resolveSides(demo: NormalizedDemo) {
  const seen = new Map<number, Map<string, Side>>();
  const note = (round: number, id: string | undefined, team: unknown) => {
    if (!id || !isSide(team)) return;
    const map = seen.get(round) ?? new Map<string, Side>();
    seen.set(round, map);
    map.set(id, team);
  };
  for (const e of demo.events) {
    switch (e.type) {
      case "kill":
      case "damage":
      case "flashed":
        note(e.round, e.victimId, e.victimTeam);
        note(e.round, e.attackerId, e.attackerTeam);
        break;
      case "shot":
        note(e.round, e.shooterId, e.shooterTeam);
        break;
      case "grenade":
        note(e.round, e.throwerId, e.throwerTeam);
        break;
    }
  }
  // Freeze-time economy samples carry every participant's team (parser cs2live.2+).
  for (const round of demo.rounds)
    for (const row of round.economy ?? [])
      note(round.number, row.steamId, row.team);
  const sides = new Map<number, Map<string, Side>>();
  for (const round of demo.rounds) {
    const resolved = new Map<string, Side>();
    for (const player of round.participants) {
      let side = seen.get(round.number)?.get(player);
      for (let d = 1; !side && d < 12; d++)
        for (const r of [round.number - d, round.number + d])
          if (!side && r > 0 && half(r) === half(round.number))
            side = seen.get(r)?.get(player);
      if (side) resolved.set(player, side);
    }
    sides.set(round.number, resolved);
  }
  return sides;
}

export type PlayerAdvanced = {
  rows: PlayerRound[];
  ids: {
    openingKills: string[];
    openingDeaths: string[];
    tradeKills: string[];
    tradedDeaths: string[];
    clutches: string[];
    multiKills: string[];
    damageWon: string[];
    damageLost: string[];
    damageCT: string[];
    damageT: string[];
  };
  clutchAttempts: number;
  clutchWins: number;
  clutchComplete: boolean;
  sidesComplete: boolean;
};

export function playerAdvanced(
  demo: NormalizedDemo,
  sides: Map<number, Map<string, Side>>,
  steamId: string,
): PlayerAdvanced {
  const byRound = new Map<number, DemoEvent[]>();
  for (const e of demo.events) {
    const list = byRound.get(e.round) ?? [];
    list.push(e);
    byRound.set(e.round, list);
  }
  const ids: PlayerAdvanced["ids"] = {
    openingKills: [],
    openingDeaths: [],
    tradeKills: [],
    tradedDeaths: [],
    clutches: [],
    multiKills: [],
    damageWon: [],
    damageLost: [],
    damageCT: [],
    damageT: [],
  };
  const rows: PlayerRound[] = [];
  let clutchAttempts = 0;
  let clutchWins = 0;
  let clutchComplete = true;
  let sidesComplete = true;
  for (const round of demo.rounds) {
    if (!round.participants.includes(steamId)) continue;
    const roundSides = sides.get(round.number)!;
    const side = roundSides.get(steamId);
    if (!side) sidesComplete = false;
    const events = [...(byRound.get(round.number) ?? [])].sort(
      (a, b) => a.tick - b.tick,
    );
    const kills = events.filter((e): e is Kill => e.type === "kill");
    const enemy = (e: Kill | Damage) =>
      e.attackerId !== e.victimId &&
      isSide(e.attackerTeam) &&
      isSide(e.victimTeam) &&
      e.attackerTeam !== e.victimTeam;
    const ownKills = kills.filter((e) => e.attackerId === steamId && enemy(e));
    const death = kills.find((e) => e.victimId === steamId);
    const damage = events.filter(
      (e): e is Damage =>
        e.type === "damage" && e.attackerId === steamId && enemy(e),
    );
    const damageTotal = damage.reduce((n, e) => n + e.healthDamage, 0);
    const won = side && round.winner ? round.winner === side : undefined;
    if (won !== undefined)
      (won ? ids.damageWon : ids.damageLost).push(...damage.map((e) => e.id));
    if (side)
      (side === "CT" ? ids.damageCT : ids.damageT).push(
        ...damage.map((e) => e.id),
      );
    // Opening duel: the first death of the round.
    const first = kills[0];
    let opening: PlayerRound["opening"];
    if (first && first.attackerId === steamId && enemy(first)) {
      opening = "kill";
      ids.openingKills.push(first.id);
    } else if (first && first.victimId === steamId) {
      opening = "death";
      ids.openingDeaths.push(first.id);
    }
    // Trades.
    let traded = false;
    if (death?.attackerId) {
      const revenge = kills.find(
        (e) =>
          e.victimId === death.attackerId &&
          e.attackerId !== steamId &&
          e.attackerTeam === death.victimTeam &&
          e.tick >= death.tick &&
          e.tick - death.tick <= TRADE_TICKS,
      );
      if (revenge) {
        traded = true;
        ids.tradedDeaths.push(death.id, revenge.id);
      }
    }
    for (const k of ownKills) {
      const avenged = kills.find(
        (e) =>
          e.attackerId === k.victimId &&
          e.victimId !== steamId &&
          e.victimTeam === k.attackerTeam &&
          e.tick <= k.tick &&
          k.tick - e.tick <= TRADE_TICKS,
      );
      if (avenged) ids.tradeKills.push(k.id);
    }
    // Damage assists: damaged an enemy that someone else killed this round.
    const damageAssist = damage.some((d) =>
      kills.some((k) => k.victimId === d.victimId && k.attackerId !== steamId),
    );
    if (ownKills.length >= 2) ids.multiKills.push(...ownKills.map((e) => e.id));
    // Clutch: the player is the last one alive on their side with enemies left.
    let clutchVs: number | undefined;
    if (side && round.participants.every((p) => roundSides.has(p))) {
      const alive = new Set(round.participants);
      const count = (s: Side) =>
        [...alive].filter((p) => roundSides.get(p) === s).length;
      for (const k of kills) {
        alive.delete(k.victimId);
        if (
          clutchVs === undefined &&
          alive.has(steamId) &&
          count(side) === 1 &&
          count(side === "CT" ? "T" : "CT") > 0
        ) {
          clutchVs = count(side === "CT" ? "T" : "CT");
          ids.clutches.push(k.id);
        }
      }
      if (clutchVs !== undefined) {
        clutchAttempts++;
        if (won) clutchWins++;
      }
    } else clutchComplete = false;
    rows.push({
      round: round.number,
      ...(side ? { side } : {}),
      kills: ownKills.length,
      headshots: ownKills.filter((e) => e.headshot).length,
      damage: damageTotal,
      died: !!death,
      traded,
      damageAssist,
      ...(won !== undefined ? { won } : {}),
      ...(opening ? { opening } : {}),
      ...(clutchVs ? { clutchVs } : {}),
      ...(death?.attackerId ? { killedBy: death.attackerId } : {}),
    });
  }
  return {
    rows,
    ids,
    clutchAttempts,
    clutchWins,
    clutchComplete,
    sidesComplete,
  };
}
