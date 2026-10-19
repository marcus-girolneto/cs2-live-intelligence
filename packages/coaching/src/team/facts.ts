/**
 * Citable team facts (ids "team-…", descriptions use aliases P1-P5 only), inferred roles,
 * deterministic team scores versus the enemy team and key-round candidates.
 */
import type { Analysis, TeamFact, TeamReview } from "@cs2/contracts";
import { scoreLabel } from "../review.js";
import {
  defined,
  pct,
  r1,
  rosterOf,
  roundViews,
  teamFact,
  timeOf,
  type Roster,
  type RoundView,
} from "./roster.js";
import { sideStats, type SideStats } from "./stats.js";

export type TeamRole = TeamReview["roles"][number]["role"];
export type RoundCandidate = {
  round: number;
  kind:
    | "lost_with_advantage"
    | "won_from_behind"
    | "post_plant_lost"
    | "retake_won"
    | "retake_lost"
    | "underdog_won"
    | "opening_lost";
  side: "CT" | "T";
  won: boolean;
  situation?: string;
  teamBuy?: string;
  /** Kills of the round in order, from the team's view (aliases, never names). */
  kills: { time: number; outcome: string; weapon?: string }[];
  eventIds: string[];
};
export type TeamAnalysis = {
  roster: Roster;
  views: RoundView[];
  us: SideStats;
  them: SideStats;
  facts: TeamFact[];
  roles: Map<string, TeamRole>;
  scores: TeamReview["teamScores"];
  candidates: RoundCandidate[];
};

const ids = (list: { id: string }[]) => list.map((e) => e.id);

function inferRoles(
  analysis: Analysis,
  a: Omit<TeamAnalysis, "roles" | "facts" | "scores" | "candidates">,
) {
  const roles = new Map<string, TeamRole>();
  const rounds = Math.max(1, a.views.length);
  const kills = (analysis.events ?? []).filter((e) => e.type === "kill");
  const flashes = (analysis.events ?? []).filter(
    (e) => e.type === "grenade" && e.grenade === "flash",
  );
  const contactMean = (id: string) => {
    const t = a.us.firstContactTimes.get(id) ?? [];
    return t.length ? t.reduce((x, y) => x + y, 0) / t.length : 0;
  };
  const team = a.roster.members;
  const means = team.map(contactMean).sort((x, y) => x - y);
  const median = means[Math.floor(means.length / 2)] ?? 0;
  const entry = [...team].sort(
    (x, y) => (a.us.firstContact.get(y) ?? 0) - (a.us.firstContact.get(x) ?? 0),
  )[0];
  const support = [...team].sort(
    (x, y) =>
      flashes.filter((f) => f.type === "grenade" && f.throwerId === y).length -
      flashes.filter((f) => f.type === "grenade" && f.throwerId === x).length,
  )[0];
  for (const id of team) {
    const mine = kills.filter((k) => k.type === "kill" && k.attackerId === id);
    const sniper = mine.filter(
      (k) => k.type === "kill" && /awp|ssg08/i.test(k.weapon ?? ""),
    ).length;
    const opens = a.us.firstContact.get(id) ?? 0;
    if (mine.length >= 3 && sniper / mine.length >= 0.4) roles.set(id, "awper");
    else if (id === entry && opens >= 3 && opens / rounds >= 0.2)
      roles.set(id, "entry");
    else if (
      id === support &&
      flashes.filter((f) => f.type === "grenade" && f.throwerId === id)
        .length >=
        rounds / 3
    )
      roles.set(id, "support");
    else if (contactMean(id) > median + 10 && opens / rounds < 0.15)
      roles.set(id, "lurker");
    else roles.set(id, "flex");
  }
  return roles;
}

function facts(
  a: Omit<TeamAnalysis, "facts" | "scores" | "candidates">,
): TeamFact[] {
  const { us, roster } = a;
  const al = (id: string) => roster.alias.get(id) ?? "P?";
  const out: (TeamFact | undefined)[] = [
    teamFact(
      "team-traded-deaths",
      "team-trading",
      `team deaths traded within 5 s: ${us.traded.length} / ${us.deaths.length}`,
      pct(us.traded.length, us.deaths.length),
      us.deaths.length,
      ids(us.deaths),
    ),
    teamFact(
      "team-opening-success",
      "team-opening",
      `opening duels won by the team: ${us.openings.won.length} / ${us.openings.won.length + us.openings.lost.length}`,
      pct(
        us.openings.won.length,
        us.openings.won.length + us.openings.lost.length,
      ),
      us.openings.won.length + us.openings.lost.length,
      ids([...us.openings.won, ...us.openings.lost]),
    ),
    teamFact(
      "team-flash-chains",
      "team-utility",
      `enemies flashed by one player and killed by another within 2 s: ${us.flashChains.length} (of ${us.flashesOnEnemies} enemies flashed)`,
      us.flashChains.length,
      us.flashesOnEnemies,
      us.flashChains.flatMap((c) => [c.flash.id, c.kill.id]),
    ),
    teamFact(
      "team-nades-together",
      "team-utility",
      `grenade groups thrown by 2+ players within 3 s: ${us.together.length} in ${us.roundsWithGrenades} rounds with grenades`,
      us.together.length,
      us.roundsWithGrenades,
      us.together.flat().map((g) => g.id),
    ),
    teamFact(
      "team-advantage-conversion",
      "team-conversion",
      `rounds won after going up in players: ${us.advantage.won.length} / ${us.advantage.rounds.length}`,
      pct(us.advantage.won.length, us.advantage.rounds.length),
      us.advantage.rounds.length,
      us.advantage.rounds.flatMap((v) => (v.roundEndId ? [v.roundEndId] : [])),
    ),
    teamFact(
      "team-underdog-rounds",
      "team-economy",
      `non-pistol rounds bought below the enemy and won: ${us.underdog.won.length} / ${us.underdog.rounds.length}`,
      pct(us.underdog.won.length, us.underdog.rounds.length),
      us.underdog.rounds.length,
      roundEnds(a.views, us.underdog.rounds),
    ),
    teamFact(
      "team-post-plants",
      "team-rounds",
      `post-plant rounds won (team planted): ${us.postPlants.won.length} / ${us.postPlants.rounds.length}`,
      pct(us.postPlants.won.length, us.postPlants.rounds.length),
      us.postPlants.rounds.length,
      us.postPlants.events,
    ),
    teamFact(
      "team-retakes",
      "team-rounds",
      `retakes won (enemy planted): ${us.retakes.won.length} / ${us.retakes.rounds.length}`,
      pct(us.retakes.won.length, us.retakes.rounds.length),
      us.retakes.rounds.length,
      us.retakes.events,
    ),
  ];
  for (const side of ["CT", "T"] as const) {
    const u = us.utilityBySide[side];
    out.push(
      teamFact(
        `team-smokes-per-round-${side.toLowerCase()}`,
        "team-utility",
        `${side} side: ${u.smokes.length} smokes and ${u.molotovs.length} molotovs in ${u.rounds} rounds (per round: ${u.rounds ? r1(u.smokes.length / u.rounds) : 0} smokes, ${u.rounds ? r1(u.molotovs.length / u.rounds) : 0} molotovs)`,
        u.rounds ? r1(u.smokes.length / u.rounds) : null,
        u.rounds,
        ids([...u.smokes, ...u.molotovs]),
      ),
    );
  }
  const situations = new Map<string, { rounds: number[]; won: number[] }>();
  for (const v of us.advantage.rounds) {
    const s = us.advantage.first.get(v.round)!;
    if (!situations.has(s)) situations.set(s, { rounds: [], won: [] });
    situations.get(s)!.rounds.push(v.round);
    if (us.advantage.won.includes(v)) situations.get(s)!.won.push(v.round);
  }
  for (const [s, x] of situations)
    out.push(
      teamFact(
        `team-advantage-${s}`,
        "team-conversion",
        `rounds where the team first went ${s}: won ${x.won.length} / ${x.rounds.length}`,
        pct(x.won.length, x.rounds.length),
        x.rounds.length,
        roundEnds(a.views, x.rounds),
      ),
    );
  for (const id of roster.members) {
    const untraded = us.untraded.get(id) ?? [];
    const deaths = us.deaths.filter((k) => k.victimId === id);
    out.push(
      teamFact(
        `team-untraded-${al(id)}`,
        "team-trading",
        `${al(id)} deaths not traded within 5 s: ${untraded.length} / ${deaths.length}`,
        untraded.length,
        deaths.length,
        ids(untraded),
        id,
      ),
    );
    for (const side of ["CT", "T"] as const) {
      const o = us.openingBy.get(`${id}|${side}`);
      if (!o) continue;
      const n = o.won.length + o.lost.length;
      out.push(
        teamFact(
          `team-opening-${al(id)}-${side.toLowerCase()}`,
          "team-opening",
          `${al(id)} opening duels on ${side}: won ${o.won.length} / ${n}`,
          pct(o.won.length, n),
          n,
          ids([...o.won, ...o.lost]),
          id,
        ),
      );
    }
    const chains = us.flashChains.filter((c) => c.flash.attackerId === id);
    if (chains.length)
      out.push(
        teamFact(
          `team-flash-assists-${al(id)}`,
          "team-utility",
          `${al(id)} flashes that led to a teammate's kill within 2 s: ${chains.length}`,
          chains.length,
          chains.length,
          chains.flatMap((c) => [c.flash.id, c.kill.id]),
          id,
        ),
      );
    const c = us.clutches.get(id);
    if (c)
      out.push(
        teamFact(
          `team-clutches-${al(id)}`,
          "team-clutch",
          `${al(id)} clutches won: ${c.won.length} / ${c.attempts.length}`,
          c.won.length,
          c.attempts.length,
          roundEnds(a.views, c.attempts),
          id,
        ),
      );
  }
  for (const [pair, list] of [...us.tradePairs.entries()]
    .sort((x, y) => y[1].length - x[1].length)
    .slice(0, 6)) {
    const [trader, traded] = pair.split(">") as [string, string];
    out.push(
      teamFact(
        `team-trade-${al(trader)}-for-${al(traded)}`,
        "team-trading",
        `${al(trader)} traded ${al(traded)}'s death ${list.length} time(s)`,
        list.length,
        list.length,
        ids(list),
      ),
    );
  }
  return defined(out);
}

const roundEnds = (views: RoundView[], rounds: number[]) =>
  views
    .filter((v) => rounds.includes(v.round) && v.roundEndId)
    .map((v) => v.roundEndId!);

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
const score = (value: number, basis: string) => ({
  value: clamp(value),
  label: scoreLabel(clamp(value)),
  basis: basis.slice(0, 500),
});

/** Team versus enemy, 50 = even (omitted when a side has too little data). */
function scores(us: SideStats, them: SideStats): TeamReview["teamScores"] {
  const out: TeamReview["teamScores"] = {};
  const rate = (a: number, b: number) => (b > 0 ? (100 * a) / b : null);
  const tradeUs = rate(us.traded.length, us.deaths.length);
  const tradeThem = rate(them.traded.length, them.deaths.length);
  if (
    tradeUs !== null &&
    tradeThem !== null &&
    us.deaths.length >= 5 &&
    them.deaths.length >= 5
  )
    out.trading = score(
      50 + (tradeUs - tradeThem) / 1.2,
      `deaths traded ${r1(tradeUs)}% vs enemy ${r1(tradeThem)}%`,
    );
  const openings = us.openings.won.length + us.openings.lost.length;
  if (openings >= 5)
    out.opening = score(
      (100 * us.openings.won.length) / openings,
      `opening duels won ${us.openings.won.length} of ${openings}`,
    );
  const perRound = (s: SideStats) =>
    s.rounds ? (s.flashChains.length + s.together.length) / s.rounds : 0;
  if (us.rounds >= 8)
    out.utility = score(
      50 + 100 * (perRound(us) - perRound(them)),
      `flash-assist chains + coordinated throws per round ${r1(perRound(us))} vs enemy ${r1(perRound(them))}`,
    );
  const econUs = rate(us.underdog.won.length, us.underdog.rounds.length);
  const econThem = rate(them.underdog.won.length, them.underdog.rounds.length);
  if (us.underdog.rounds.length + them.underdog.rounds.length >= 4)
    out.economy = score(
      50 + ((econUs ?? 0) - (econThem ?? 0)) / 2,
      `rounds won while bought below the enemy ${us.underdog.won.length}/${us.underdog.rounds.length} vs enemy ${them.underdog.won.length}/${them.underdog.rounds.length}`,
    );
  const convUs = rate(us.advantage.won.length, us.advantage.rounds.length);
  const convThem = rate(
    them.advantage.won.length,
    them.advantage.rounds.length,
  );
  if (convUs !== null && convThem !== null && us.advantage.rounds.length >= 3)
    out.conversion = score(
      50 + (convUs - convThem) / 2,
      `man-advantage rounds won ${r1(convUs)}% vs enemy ${r1(convThem)}%`,
    );
  return out;
}

function candidates(
  a: Omit<TeamAnalysis, "facts" | "scores" | "candidates" | "roles">,
): RoundCandidate[] {
  const out: RoundCandidate[] = [];
  const al = (id?: string) => (id ? a.roster.alias.get(id) : undefined);
  for (const v of a.views) {
    if (v.won === undefined) continue;
    const kinds: RoundCandidate["kind"][] = [];
    const adv = a.us.advantage.first.get(v.round);
    if (adv && !v.won) kinds.push("lost_with_advantage");
    const behind = v.alive.some(([x, y]) => x < y);
    if (behind && v.won && !adv) kinds.push("won_from_behind");
    if (a.us.postPlants.rounds.includes(v.round) && !v.won)
      kinds.push("post_plant_lost");
    if (a.us.retakes.rounds.includes(v.round))
      kinds.push(v.won ? "retake_won" : "retake_lost");
    if (a.us.underdog.won.includes(v.round)) kinds.push("underdog_won");
    if (!kinds.length) continue;
    out.push({
      round: v.round,
      kind: kinds[0]!,
      side: v.side,
      won: v.won,
      ...(adv ? { situation: adv } : {}),
      ...(a.us.buys.get(v.round) ? { teamBuy: a.us.buys.get(v.round) } : {}),
      kills: v.kills.slice(0, 10).map((k) => ({
        time: r1(timeOf(k)),
        outcome: a.roster.members.includes(k.victimId)
          ? `${al(k.victimId)} died`
          : `${al(k.attackerId) ?? "a teammate"} killed an enemy`,
        ...(k.weapon ? { weapon: k.weapon } : {}),
      })),
      eventIds: [
        ...v.kills.map((k) => k.id),
        ...(v.roundEndId ? [v.roundEndId] : []),
      ].slice(0, 20),
    });
  }
  const weight = (c: RoundCandidate) =>
    ["lost_with_advantage", "post_plant_lost", "retake_lost"].includes(c.kind)
      ? 0
      : 1;
  return out
    .sort((x, y) => weight(x) - weight(y) || x.round - y.round)
    .slice(0, 16)
    .sort((x, y) => x.round - y.round);
}

/** Every deterministic part of a team review for the team of `steamId`. */
export function analyzeTeam(analysis: Analysis, steamId: string): TeamAnalysis {
  const roster = rosterOf(analysis, steamId);
  const views = roundViews(analysis, roster);
  const usIds = new Set(roster.members);
  const themIds = new Set(roster.enemies);
  const us = sideStats(analysis, views, usIds, themIds, true);
  const them = sideStats(analysis, views, themIds, usIds, false);
  const base = { roster, views, us, them };
  const roles = inferRoles(analysis, base);
  return {
    ...base,
    roles,
    facts: facts({ ...base, roles }),
    scores: scores(us, them),
    candidates: candidates(base),
  };
}
