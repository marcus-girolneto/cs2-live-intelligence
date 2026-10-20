/**
 * Deterministic training plan of a review, following the pro-team method (method.ts):
 * Review, Warmup, Area habit, Focused block, Debrief. Weak areas come from the review
 * (plan target metrics, drill areas, scores) and the deep modules; resources, commands and
 * Workshop ids come only from the verified catalog and the demo, never from a model.
 */
import type {
  Analysis,
  Coaching,
  DeepReview,
  Teleport,
  TrainingPlan,
  TrainingSession,
} from "@cs2/contracts";
import { clipsFor } from "../review.js";
import { cleanPlace, ReplayIndex, type DeepReplay } from "../deep/common.js";
import { computeDeep } from "../deep/index.js";
import { mapEntry, type TrainingSkill } from "./catalog.js";
import { botSetup, PRACTICE_CONFIG } from "./console.js";
import { STEP_MINUTES } from "./method.js";
import {
  buildTeleports,
  measuredDuels,
  ON_TARGET_DEGREES,
} from "./teleports.js";
import { sessionText, MINDSET, type SessionCode } from "./texts.js";

/** The parts of a stored review the plan reads (all optional). */
export type TrainingReview = Pick<
  Partial<Coaching>,
  "planItems" | "drills" | "scores" | "deep"
>;
export type TrainingInput = {
  analysis: Analysis;
  steamId: string;
  replay?: DeepReplay;
  /** Latest review of this player in this match (refines the ranking). */
  review?: TrainingReview;
};

const METRIC_SKILL: Record<string, TrainingSkill> = {
  crosshairMedianDeg: "crosshair",
  openingWinPct: "crosshair",
  hsPct: "aim",
  kd: "aim",
  adr: "aim",
  accuracy: "spray",
  utilityDamagePerRound: "utility",
  isolatedDeathsPct: "positioning",
  tradedDeathsPct: "positioning",
  kast: "positioning",
};
const AREA_SKILL: Record<string, TrainingSkill> = {
  utility: "utility",
  crosshair: "crosshair",
  positioning: "positioning",
  trading: "positioning",
  aim: "aim",
};

/** Weakest skills first: review targets, then drills, scores and the deep numbers. */
export function rankSkills(
  review: TrainingReview | undefined,
  deep: DeepReview | undefined,
  hsPct: number | null,
  /** Share of measured duels with the crosshair on target (null: not measured). */
  onTarget: number | null = null,
): TrainingSkill[] {
  const score = new Map<TrainingSkill, number>();
  const add = (s: TrainingSkill | undefined, w: number) => {
    if (s) score.set(s, (score.get(s) ?? 0) + w);
  };
  (review?.planItems ?? []).forEach((p, i) =>
    add(METRIC_SKILL[p.targetMetric ?? ""], 6 - i),
  );
  (review?.drills ?? []).forEach((d) => add(AREA_SKILL[d.area ?? ""], 2));
  const scores = Object.entries(review?.scores ?? {})
    .map(([k, v]) => [k, v?.value] as const)
    .filter((e): e is readonly [string, number] => typeof e[1] === "number")
    .sort((a, b) => a[1] - b[1]);
  if (scores[0] && scores[0][1] < 50) add(AREA_SKILL[scores[0][0]], 3);
  if (onTarget !== null && onTarget < 0.5) add("crosshair", 3);
  const p = deep?.positioning;
  if (p?.isolatedPct != null && p.isolatedPct >= 40) add("positioning", 3);
  if (p?.tradedPct != null && p.tradedPct < 30) add("positioning", 2);
  if ((p?.dangerZones.length ?? 0) > 0) add("positioning", 1);
  const f = deep?.utility?.stats.flash;
  if (f?.teamFlashRate != null && f.teamFlashRate >= 30) add("utility", 3);
  if (f?.effectivePct != null && f.thrown >= 3 && f.effectivePct < 40)
    add("utility", 2);
  if (hsPct !== null && hsPct < 35) add("aim", 2);
  const ranked = [...score.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([s]) => s);
  return ranked.length ? ranked.slice(0, 3) : ["aim"];
}

type Role = NonNullable<TrainingPlan["role"]>;
/** A modest role guess from this match only (opening duels, utility, isolation). */
export function inferRole(
  analysis: Analysis,
  steamId: string,
  deep: DeepReview | undefined,
): Role | undefined {
  const rounds =
    analysis.players.find((p) => p.steamId === steamId)?.rounds ?? [];
  if (rounds.length < 8) return undefined;
  const opening = rounds.filter((r) => r.opening).length / rounds.length;
  const utility = (deep?.utility?.thrown ?? 0) / rounds.length;
  const isolated = deep?.positioning?.isolatedPct ?? 0;
  if (opening >= 0.3) return "entry";
  if (utility >= 1.6) return "support";
  if (isolated >= 55) return "lurker";
  return "rifler";
}

/** "de_dust2" -> "Dust 2" (display only). */
export function mapTitle(map: string | undefined): string | undefined {
  if (!map) return undefined;
  const base = map.replace(/^(de|cs|ar)_/, "");
  const named: Record<string, string> = { dust2: "Dust 2" };
  return (
    named[base] ??
    base.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

const hs = (analysis: Analysis, steamId: string): number | null =>
  analysis.players.find((p) => p.steamId === steamId)?.headshotPercentage
    .value ?? null;

function session(
  step: TrainingSession["step"],
  code: SessionCode,
  params: Record<string, string | number>,
  extra: Partial<TrainingSession> & { minutes?: number },
): TrainingSession {
  const text = sessionText(code, params);
  return {
    id: `${step}-${code}`,
    step,
    code,
    params,
    ...text,
    minutes: extra.minutes ?? STEP_MINUTES[step],
    resourceIds: [],
    ...extra,
  };
}

const ids = (list: Teleport[], kinds: Teleport["kind"][]) =>
  list.filter((t) => kinds.includes(t.kind)).map((t) => t.id);

function habitSession(
  skill: TrainingSkill,
  map: string | undefined,
  area: string,
  teleports: Teleport[],
  minutes: number,
): TrainingSession {
  const mapName = mapTitle(map) ?? "your map";
  if (skill === "crosshair") {
    const spots = ids(teleports, ["crosshair"]);
    const prefire = mapEntry("prefire", map);
    return session(
      "habit",
      spots.length ? "habit_crosshair_spots" : "habit_prefire",
      { map: mapName, area, n: spots.length },
      {
        skill,
        minutes,
        resourceIds: prefire ? [prefire.id] : ["yprac-hub"],
        ...(spots.length ? { teleportIds: spots } : {}),
      },
    );
  }
  if (skill === "utility") {
    const lineups = ids(teleports, ["lineup", "teamflash"]);
    const utility = mapEntry("utility", map);
    return session(
      "habit",
      lineups.length ? "habit_lineups" : "habit_utility_map",
      { map: mapName, area, n: lineups.length },
      {
        skill,
        minutes,
        resourceIds: [utility?.id ?? "practice-server"],
        ...(lineups.length ? { teleportIds: lineups } : {}),
      },
    );
  }
  if (skill === "positioning") {
    const spots = ids(teleports, ["death", "enemy"]);
    const prefire = mapEntry("prefire", map);
    return session(
      "habit",
      spots.length ? "habit_death_spots" : "habit_prefire",
      { map: mapName, area, n: spots.length },
      {
        skill,
        minutes,
        resourceIds: spots.length
          ? ["your-spots"]
          : prefire
            ? [prefire.id]
            : ["yprac-hub"],
        ...(spots.length ? { teleportIds: spots } : {}),
      },
    );
  }
  if (skill === "spray")
    return session(
      "habit",
      "habit_spray",
      { map: mapName, area },
      { skill, minutes, resourceIds: ["recoil-master"] },
    );
  if (skill === "movement")
    return session(
      "habit",
      "habit_movement",
      { map: mapName, area },
      { skill, minutes, resourceIds: ["counter-strafe-master"] },
    );
  return session(
    "habit",
    "habit_aim",
    { map: mapName, area },
    { skill, minutes, resourceIds: ["aim-botz"] },
  );
}

/** Where the plan focuses: the top danger zone and the side you died on most there. */
function focusArea(
  analysis: Analysis,
  steamId: string,
  deep: DeepReview | undefined,
): { area?: string; side?: "CT" | "T"; deaths: number } {
  const zone = deep?.positioning?.dangerZones[0];
  const rounds =
    analysis.players.find((p) => p.steamId === steamId)?.rounds ?? [];
  const sideOf = new Map(rounds.map((r) => [r.round, r.side]));
  if (!zone) {
    const sides = rounds.filter((r) => r.died).map((r) => r.side);
    const t = sides.filter((s) => s === "T").length;
    const ct = sides.filter((s) => s === "CT").length;
    return { ...(t || ct ? { side: t > ct ? "T" : "CT" } : {}), deaths: 0 };
  }
  const t = zone.rounds.filter((r) => sideOf.get(r) === "T").length;
  const ct = zone.rounds.filter((r) => sideOf.get(r) === "CT").length;
  return {
    area: cleanPlace(zone.place),
    ...(t || ct ? { side: t > ct ? "T" : "CT" } : {}),
    deaths: zone.deaths,
  };
}

/** Clips of your deaths at `area` in rounds you lost (the review question's evidence). */
function reviewClips(
  analysis: Analysis,
  steamId: string,
  area: string | undefined,
): TrainingSession["clips"] {
  const lost = new Set(
    (analysis.players.find((p) => p.steamId === steamId)?.rounds ?? [])
      .filter((r) => r.won === false)
      .map((r) => r.round),
  );
  const deaths = (analysis.events ?? []).filter(
    (e) =>
      e.type === "kill" &&
      e.victimId === steamId &&
      lost.has(e.round) &&
      (!area || cleanPlace(e.victimPlace) === area) &&
      typeof (e as { roundTime?: unknown }).roundTime === "number",
  ) as Parameters<typeof clipsFor>[1];
  return clipsFor(analysis, deaths, steamId, 3, `Death at ${area ?? "?"}`);
}

export function buildTrainingPlan(input: TrainingInput): TrainingPlan {
  const { analysis, steamId } = input;
  const replay = new ReplayIndex(input.replay);
  const deep =
    input.review?.deep ?? computeDeep(analysis, steamId, input.replay).deep;
  const duels = measuredDuels(analysis, steamId, replay);
  const onTarget =
    duels.length >= 5
      ? duels.filter((d) => d.off < ON_TARGET_DEGREES).length / duels.length
      : null;
  const focus = rankSkills(input.review, deep, hs(analysis, steamId), onTarget);
  const primary = focus[0]!;
  const secondary = focus[1];
  // Demo text: only a plain map name may reach a console command.
  const map =
    analysis.map && /^[a-z0-9_]{1,32}$/.test(analysis.map)
      ? analysis.map
      : undefined;
  const where = focusArea(analysis, steamId, deep);
  const area = where.area ?? "your main area";
  const side = where.side ?? "CT";
  const role = inferRole(analysis, steamId, deep);
  const teleports = buildTeleports(analysis, steamId, deep, replay);
  const clips = reviewClips(analysis, steamId, where.area);
  const sessions: TrainingSession[] = [
    session(
      "review",
      where.area ? "review_zone" : "review_deaths",
      { area, side, n: where.deaths, map: mapTitle(map) ?? "this map" },
      { clips },
    ),
    session(
      "warmup",
      primary === "spray" ? "warmup_spray" : "warmup_aim",
      {},
      {
        skill: primary === "spray" ? "spray" : "aim",
        resourceIds: [primary === "spray" ? "recoil-master" : "aim-botz"],
      },
    ),
    habitSession(primary, map, area, teleports, secondary ? 15 : 20),
    ...(secondary ? [habitSession(secondary, map, area, teleports, 10)] : []),
    session(
      "focus",
      `focus_${primary}` as SessionCode,
      { area, side, map: mapTitle(map) ?? "this map" },
      {
        skill: primary,
        // Utility and positioning are trained in real rounds, not deathmatch.
        resourceIds:
          primary === "utility" || primary === "positioning"
            ? []
            : ["official-deathmatch"],
      },
    ),
    session("debrief", "debrief", { area }, {}),
  ];
  // A second habit block of the same kind would repeat the same session id.
  const unique = sessions.filter(
    (s, i) => sessions.findIndex((o) => o.id === s.id) === i,
  );
  const enemySide = side === "CT" ? "T" : "CT";
  const caveats: string[] = [];
  if (!replay.available)
    caveats.push(
      "No replay samples for this match: view angles are computed toward the enemy, and lineups and crosshair spots are unavailable.",
    );
  if (teleports.some((t) => t.approximate))
    caveats.push(
      "Spots taken from replay samples are approximate: fine-tune lineups with the trajectory preview.",
    );
  return {
    version: "training-1",
    ...(map ? { map } : {}),
    side,
    ...(where.area ? { area: where.area } : {}),
    ...(role ? { role } : {}),
    focus,
    mindset: { code: primary, text: MINDSET[primary] },
    sessions: unique,
    practiceConfig: [...PRACTICE_CONFIG],
    serverSetup: [...(map ? [`map ${map}`] : []), ...botSetup(enemySide)].slice(
      0,
      4,
    ),
    teleports,
    caveats,
  };
}
