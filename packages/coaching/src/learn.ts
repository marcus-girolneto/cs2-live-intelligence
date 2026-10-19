import type { Analysis } from "@cs2/contracts";

type Player = Analysis["players"][number];
type Metric = Player["adr"];
const usable = (m: Metric | undefined): m is Metric =>
  !!m && m.complete && m.value !== null && Number.isFinite(m.value);
const round1 = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: number[]) =>
  xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null;

export type LearnedMetric = {
  /** Average over every analyzed match where the metric is complete. */
  overall: number | null;
  /** Average over the most recent matches (up to RECENT). */
  recent: number | null;
  matches: number;
};
export type LearnedProfile = {
  steamId: string;
  matches: number;
  rounds: number;
  maps: Record<string, number>;
  metrics: Record<string, LearnedMetric>;
  tendencies: string[];
  recurring: { pattern: string; matches: number }[];
  /** The same learning restricted to each map, plus where the player kills and dies there. */
  perMap?: Record<string, MapProfile>;
};
export type MapProfile = {
  matches: number;
  rounds: number;
  lastPlayedAt: string;
  metrics: Record<string, LearnedMetric>;
  recurring: { pattern: string; matches: number }[];
  /** Callouts summed over this map's matches, most involved first (top 8). */
  places: { place: string; kills: number; deaths: number; matches: number }[];
};
export const RECENT = 3;

const METRICS: Record<string, (p: Player) => Metric | undefined> = {
  adr: (p) => p.adr,
  kd: (p) =>
    usable(p.kills) && usable(p.deaths)
      ? {
          ...p.kills,
          value:
            p.deaths.value! > 0
              ? Math.round((p.kills.value! / p.deaths.value!) * 100) / 100
              : p.kills.value,
        }
      : undefined,
  headshotPercentage: (p) => p.headshotPercentage,
  kast: (p) => p.advanced?.kast,
  openingSuccess: (p) => p.advanced?.["opening-success"],
  tradedDeaths: (p) => p.advanced?.["traded-deaths"],
  survival: (p) => p.advanced?.survival,
  adrCT: (p) => p.advanced?.["adr-ct"],
  adrT: (p) => p.advanced?.["adr-t"],
};

/** Recurring weaknesses/strengths, evaluated per match with the same thresholds as the rule engine. */
const PATTERNS: { pattern: string; test: (p: Player) => boolean }[] = [
  {
    pattern: "loses most opening duels",
    test: (p) => {
      const m = p.advanced?.["opening-success"];
      return usable(m) && m.denominator >= 3 && m.value! < 40;
    },
  },
  {
    pattern: "wins most opening duels",
    test: (p) => {
      const m = p.advanced?.["opening-success"];
      return usable(m) && m.denominator >= 3 && m.value! >= 60;
    },
  },
  {
    pattern: "deaths rarely traded",
    test: (p) => {
      const m = p.advanced?.["traded-deaths"];
      return usable(m) && m.denominator >= 4 && m.value! < 30;
    },
  },
  {
    pattern: "low round impact (KAST < 60%)",
    test: (p) => {
      const m = p.advanced?.kast;
      return usable(m) && m.value! < 60;
    },
  },
  {
    pattern: "high round impact (KAST >= 75%)",
    test: (p) => {
      const m = p.advanced?.kast;
      return usable(m) && m.value! >= 75;
    },
  },
  {
    pattern: "many rounds without damage",
    test: (p) => {
      const m = p.advanced?.["zero-damage-rounds"];
      const r = p.rounds?.length ?? 0;
      return usable(m) && r >= 5 && m.value! / r >= 0.4;
    },
  },
  {
    pattern: "low headshot rate",
    test: (p) =>
      usable(p.headshotPercentage) &&
      p.headshotPercentage.denominator >= 5 &&
      p.headshotPercentage.value! < 30,
  },
  {
    pattern: "frequent multi-kill rounds",
    test: (p) => {
      const m = p.advanced?.["multi-kill-rounds"];
      return usable(m) && m.value! >= 2;
    },
  },
];

/**
 * Learns how one player plays from every analysis that contains them, newest first.
 * Pure and deterministic: aggregates only complete metrics and never reads names.
 */
export function learnProfile(
  analyses: { analysis: Analysis; createdAt: string }[],
  steamId: string,
): LearnedProfile | null {
  const own = analyses
    .map((a) => ({
      ...a,
      player: a.analysis.players.find((p) => p.steamId === steamId),
    }))
    .filter((a): a is typeof a & { player: Player } => !!a.player)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  if (!own.length) return null;
  const metrics = learnMetrics(own);
  const rounds = own.reduce((n, a) => n + (a.player.rounds?.length ?? 0), 0);
  const openings = own.reduce(
    (n, a) => n + (a.player.rounds?.filter((r) => r.opening).length ?? 0),
    0,
  );
  const clutches = own.reduce(
    (n, a) => n + (a.player.rounds?.filter((r) => r.clutchVs).length ?? 0),
    0,
  );
  const tendencies: string[] = [];
  if (rounds >= 10) {
    const rate = openings / rounds;
    if (rate >= 0.3)
      tendencies.push("takes many opening duels (entry-style, aggressive)");
    else if (rate <= 0.1)
      tendencies.push(
        "rarely involved in opening duels (passive/support-style)",
      );
    if (clutches / rounds >= 0.15)
      tendencies.push("often the last player alive");
  }
  const survival = metrics.survival?.overall;
  if (survival != null && survival >= 50)
    tendencies.push("survives most rounds (cautious)");
  const ct = metrics.adrCT?.overall;
  const t = metrics.adrT?.overall;
  if (ct != null && t != null && Math.min(ct, t) < Math.max(ct, t) * 0.7)
    tendencies.push(`clearly stronger on ${ct > t ? "CT" : "T"} side`);
  const maps: Record<string, number> = {};
  for (const a of own)
    if (a.analysis.map) maps[a.analysis.map] = (maps[a.analysis.map] ?? 0) + 1;
  const perMap: Record<string, MapProfile> = {};
  for (const map of Object.keys(maps).sort()) {
    const games = own.filter((a) => a.analysis.map === map);
    const places = new Map<
      string,
      { kills: number; deaths: number; matches: number }
    >();
    for (const g of games)
      for (const p of g.player.detail?.places ?? []) {
        const row = places.get(p.place) ?? { kills: 0, deaths: 0, matches: 0 };
        row.kills += p.kills;
        row.deaths += p.deaths;
        row.matches++;
        places.set(p.place, row);
      }
    perMap[map] = {
      matches: games.length,
      rounds: games.reduce((n, a) => n + (a.player.rounds?.length ?? 0), 0),
      lastPlayedAt: games[0]!.createdAt,
      metrics: learnMetrics(games),
      recurring: recurringOf(games),
      places: [...places.entries()]
        .map(([place, r]) => ({ place, ...r }))
        .sort(
          (a, b) =>
            b.kills + b.deaths - (a.kills + a.deaths) ||
            a.place.localeCompare(b.place),
        )
        .slice(0, 8),
    };
  }
  return {
    steamId,
    matches: own.length,
    rounds,
    maps,
    metrics,
    tendencies,
    recurring: recurringOf(own),
    perMap,
  };
}

type Own = { player: Player; createdAt: string }[];
function learnMetrics(own: Own) {
  const metrics: Record<string, LearnedMetric> = {};
  for (const [key, pick] of Object.entries(METRICS)) {
    const values = own
      .map((a) => pick(a.player))
      .map((m) => (usable(m) ? m.value! : null));
    const present = values.filter((v): v is number => v !== null);
    metrics[key] = {
      overall: mean(present),
      recent: mean(
        values.slice(0, RECENT).filter((v): v is number => v !== null),
      ),
      matches: present.length,
    };
  }
  return metrics;
}
function recurringOf(own: Own) {
  return PATTERNS.map(({ pattern, test }) => ({
    pattern,
    matches: own.filter((a) => test(a.player)).length,
  }))
    .filter((r) => r.matches > 0)
    .sort((a, b) => b.matches - a.matches);
}

/**
 * What the model may see about the player's history for a match on `map`: the overall
 * profile (without other maps' details) and, when per-map learning is enabled, this map only.
 */
export function historyForMap(
  profile: LearnedProfile | null | undefined,
  map: string | null | undefined,
  perMapLearning = true,
) {
  if (!profile) return undefined;
  const { perMap, ...overall } = profile;
  return {
    overall,
    ...(perMapLearning && map && perMap?.[map]
      ? { thisMap: { map, ...perMap[map] } }
      : {}),
  };
}

export type PlanItem = { text: string; scope: "map" | "general"; map?: string };
export type PreviousPlan = {
  date: string;
  map?: string | null;
  items: PlanItem[];
};
/**
 * Splits earlier plans into general items and items for this map. Map-scoped items from
 * other maps are never returned. Legacy unscoped plans count as map items of their match.
 */
export function plansForMap(
  plans: PreviousPlan[] | undefined,
  map: string | null | undefined,
  perMapLearning = true,
) {
  const general: { date: string; text: string }[] = [];
  const thisMap: { date: string; text: string }[] = [];
  for (const p of plans ?? [])
    for (const item of p.items) {
      if (item.scope === "general")
        general.push({ date: p.date, text: item.text });
      else if (perMapLearning && map && (item.map ?? p.map) === map)
        thisMap.push({ date: p.date, text: item.text });
    }
  return { general: general.slice(0, 6), thisMap: thisMap.slice(0, 6) };
}
