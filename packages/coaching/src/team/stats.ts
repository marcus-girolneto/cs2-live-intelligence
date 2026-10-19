/**
 * Deterministic team statistics, computed the same way for the coached team and the enemy
 * team (scores compare the two): trades, opening duels, flash-assist chains, grenades per
 * round and thrown together, man-advantage conversion, economy upsets, post-plants/retakes
 * and clutches.
 */
import type { Analysis, DemoEvent } from "@cs2/contracts";
import {
  timeOf,
  TICK_RATE,
  TRADE_SECONDS,
  type Kill,
  type RoundView,
  type Side,
} from "./roster.js";

type Grenade = Extract<DemoEvent, { type: "grenade" }>;
type Flashed = Extract<DemoEvent, { type: "flashed" }>;
type Bomb = Extract<DemoEvent, { type: "bomb" }>;
type Player = Analysis["players"][number];
export const FLASH_CHAIN_SECONDS = 2;
export const TOGETHER_SECONDS = 3;
const BUY_RANK = { pistol: 0, eco: 1, force: 2, full: 3 } as const;
type Buy = keyof typeof BUY_RANK;

export type SideStats = {
  rounds: number;
  roundsWon: number;
  deaths: Kill[];
  traded: Kill[];
  untraded: Map<string, Kill[]>;
  /** "trader>traded" → trade kills. */
  tradePairs: Map<string, Kill[]>;
  openings: { won: Kill[]; lost: Kill[] };
  /** "steamId|side" → opening duels won / taken. */
  openingBy: Map<string, { won: Kill[]; lost: Kill[] }>;
  /** Flash on an enemy followed by a teammate's kill of that enemy within 2 s. */
  flashChains: { flash: Flashed; kill: Kill }[];
  flashesOnEnemies: number;
  /** Per side: smokes and molotovs thrown and rounds played. */
  utilityBySide: Record<
    Side,
    { smokes: Grenade[]; molotovs: Grenade[]; rounds: number }
  >;
  /** Grenades of 2+ different players within 3 s (coordinated throws). */
  together: Grenade[][];
  roundsWithGrenades: number;
  /** Rounds where the side was up in players at some point, and those won ("5v4"...). */
  advantage: {
    rounds: RoundView[];
    won: RoundView[];
    first: Map<number, string>;
  };
  /** Non-pistol rounds bought below the other side, and those won. */
  underdog: { rounds: number[]; won: number[] };
  buys: Map<number, Buy>;
  postPlants: { rounds: number[]; won: number[]; events: string[] };
  retakes: { rounds: number[]; won: number[]; events: string[] };
  clutches: Map<string, { attempts: number[]; won: number[] }>;
  firstContact: Map<string, number>;
  firstContactTimes: Map<string, number[]>;
};

function buyOf(players: Player[], round: number): Buy | undefined {
  const buys = players
    .map((p) => p.rounds?.find((r) => r.round === round)?.buyType)
    .filter((b): b is Buy => !!b);
  if (!buys.length) return undefined;
  const counts = new Map<Buy, number>();
  for (const b of buys) counts.set(b, (counts.get(b) ?? 0) + 1);
  return [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || BUY_RANK[b[0]] - BUY_RANK[a[0]],
  )[0]![0];
}

/** Statistics for the players in `us` against `them` (views are from the coached team). */
export function sideStats(
  analysis: Analysis,
  views: RoundView[],
  us: Set<string>,
  them: Set<string>,
  coached: boolean,
): SideStats {
  const players = analysis.players.filter((p) => us.has(p.steamId));
  const enemies = analysis.players.filter((p) => them.has(p.steamId));
  const events = analysis.events ?? [];
  const s: SideStats = {
    rounds: 0,
    roundsWon: 0,
    deaths: [],
    traded: [],
    untraded: new Map(),
    tradePairs: new Map(),
    openings: { won: [], lost: [] },
    openingBy: new Map(),
    flashChains: [],
    flashesOnEnemies: 0,
    utilityBySide: {
      CT: { smokes: [], molotovs: [], rounds: 0 },
      T: { smokes: [], molotovs: [], rounds: 0 },
    },
    together: [],
    roundsWithGrenades: 0,
    advantage: { rounds: [], won: [], first: new Map() },
    underdog: { rounds: [], won: [] },
    buys: new Map(),
    postPlants: { rounds: [], won: [], events: [] },
    retakes: { rounds: [], won: [], events: [] },
    clutches: new Map(),
    firstContact: new Map(),
    firstContactTimes: new Map(),
  };
  const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => {
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(v);
  };
  for (const v of views) {
    const side: Side = coached ? v.side : v.side === "CT" ? "T" : "CT";
    const won = v.won === undefined ? undefined : coached ? v.won : !v.won;
    s.rounds++;
    if (won) s.roundsWon++;
    s.utilityBySide[side].rounds++;
    // Trades.
    for (const k of v.kills) {
      if (!us.has(k.victimId) || !k.attackerId || !them.has(k.attackerId))
        continue;
      s.deaths.push(k);
      const t = timeOf(k);
      const avenger = v.kills.find(
        (x) =>
          x.victimId === k.attackerId &&
          !!x.attackerId &&
          us.has(x.attackerId) &&
          timeOf(x) > t &&
          timeOf(x) - t <= TRADE_SECONDS,
      );
      if (avenger) {
        s.traded.push(k);
        push(s.tradePairs, `${avenger.attackerId}>${k.victimId}`, avenger);
      } else push(s.untraded, k.victimId, k);
    }
    // Opening duel.
    const first = v.kills.find(
      (k) => !!k.attackerId && (us.has(k.attackerId) || us.has(k.victimId)),
    );
    if (first && first === v.kills[0]) {
      const mine = !!first.attackerId && us.has(first.attackerId);
      const who = mine ? first.attackerId! : first.victimId;
      const key = `${who}|${side}`;
      if (!s.openingBy.has(key)) s.openingBy.set(key, { won: [], lost: [] });
      (mine ? s.openings.won : s.openings.lost).push(first);
      (mine ? s.openingBy.get(key)!.won : s.openingBy.get(key)!.lost).push(
        first,
      );
      s.firstContact.set(who, (s.firstContact.get(who) ?? 0) + 1);
    }
    for (const id of us) {
      const k = v.kills.find((x) => x.attackerId === id || x.victimId === id);
      if (k) push(s.firstContactTimes, id, timeOf(k));
    }
    // Man advantage (first moment the side is up in players).
    const index = v.alive.findIndex(([a, b]) =>
      coached ? a > b && b > 0 : b > a && a > 0,
    );
    if (index > 0) {
      const [a, b] = v.alive[index]!;
      s.advantage.rounds.push(v);
      s.advantage.first.set(v.round, coached ? `${a}v${b}` : `${b}v${a}`);
      if (won) s.advantage.won.push(v);
    }
    // Economy: rounds bought below the enemy.
    const mineBuy = buyOf(players, v.round);
    const theirBuy = buyOf(enemies, v.round);
    if (mineBuy) s.buys.set(v.round, mineBuy);
    if (
      mineBuy &&
      theirBuy &&
      mineBuy !== "pistol" &&
      theirBuy !== "pistol" &&
      BUY_RANK[mineBuy] < BUY_RANK[theirBuy]
    ) {
      s.underdog.rounds.push(v.round);
      if (won) s.underdog.won.push(v.round);
    }
    // Post-plants (we planted) and retakes (they planted).
    const plant = events.find(
      (e): e is Bomb =>
        e.type === "bomb" && e.round === v.round && e.action === "plant",
    );
    if (plant && won !== undefined) {
      const ours = side === "T";
      const bucket = ours ? s.postPlants : s.retakes;
      bucket.rounds.push(v.round);
      bucket.events.push(plant.id);
      if (won) bucket.won.push(v.round);
    }
    // Clutches.
    for (const p of players) {
      const row = p.rounds?.find((r) => r.round === v.round);
      if (!row?.clutchVs) continue;
      if (!s.clutches.has(p.steamId))
        s.clutches.set(p.steamId, { attempts: [], won: [] });
      s.clutches.get(p.steamId)!.attempts.push(v.round);
      if (row.won) s.clutches.get(p.steamId)!.won.push(v.round);
    }
  }
  // Utility.
  const grenades = events.filter(
    (e): e is Grenade => e.type === "grenade" && us.has(e.throwerId),
  );
  const sideOfRound = new Map(
    views.map((v) => [
      v.round,
      (coached ? v.side : v.side === "CT" ? "T" : "CT") as Side,
    ]),
  );
  const byRound = new Map<number, Grenade[]>();
  for (const g of grenades) {
    const side = sideOfRound.get(g.round);
    if (!side) continue;
    if (g.grenade === "smoke") s.utilityBySide[side].smokes.push(g);
    if (g.grenade === "molotov") s.utilityBySide[side].molotovs.push(g);
    push(byRound, g.round, g);
  }
  for (const list of byRound.values()) {
    s.roundsWithGrenades++;
    const sorted = [...list].sort((a, b) => timeOf(a) - timeOf(b));
    let group: Grenade[] = [];
    const flush = () => {
      if (new Set(group.map((g) => g.throwerId)).size >= 2)
        s.together.push(group);
      group = [];
    };
    for (const g of sorted) {
      if (group.length && timeOf(g) - timeOf(group[0]!) > TOGETHER_SECONDS)
        flush();
      group.push(g);
    }
    flush();
  }
  const flashes = events.filter(
    (e): e is Flashed =>
      e.type === "flashed" && us.has(e.attackerId) && them.has(e.victimId),
  );
  s.flashesOnEnemies = flashes.length;
  const kills = events.filter((e): e is Kill => e.type === "kill");
  for (const f of flashes) {
    const k = kills.find(
      (x) =>
        x.round === f.round &&
        x.victimId === f.victimId &&
        !!x.attackerId &&
        us.has(x.attackerId) &&
        x.attackerId !== f.attackerId &&
        x.tick >= f.tick &&
        x.tick - f.tick <= FLASH_CHAIN_SECONDS * TICK_RATE,
    );
    if (k && !s.flashChains.some((c) => c.kill.id === k.id))
      s.flashChains.push({ flash: f, kill: k });
  }
  return s;
}
