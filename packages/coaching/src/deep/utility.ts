/**
 * Deep module: utility. Per-grenade log of the coached player's throws with their measured
 * effect, efficiency stats per grenade type, utility still held at death, and lineups (your
 * most effective throws to repeat; what the lobby threw where you keep dying).
 */
import type { Analysis, DeepUtility, Evidence } from "@cs2/contracts";
import { lineups } from "./lineups.js";
import {
  CalloutIndex,
  cleanPlace,
  defined,
  eventsOf,
  fact,
  pct,
  r1,
  r2,
  ratio,
  ReplayIndex,
  type FlashedEvent,
  uniqueGrenades,
  type GrenadeEvent,
} from "./common.js";

type Nade = DeepUtility["grenades"][number]["type"];
type Throw = DeepUtility["grenades"][number];
const TYPES: Nade[] = ["flash", "he", "smoke", "molotov", "decoy"];
/** Same-detonation window in ticks (≈0.2 s at 64 tick) for flashes/HE damage. */
const SAME_TICK = 13;
/** Molotov/incendiary damage is attributed to the latest own molotov up to 7 s earlier. */
const BURN_SECONDS = 7;
const MOLOTOV_WEAPONS = new Set(["Molotov", "Incendiary Grenade"]);

function landingOf(
  g: GrenadeEvent,
  replay: ReplayIndex,
): { from?: { x: number; y: number }; landing?: { x: number; y: number } } {
  const landing = g.pos ? { x: r1(g.pos.x), y: r1(g.pos.y) } : undefined;
  const p = replay.playerIndex(g.throwerId);
  const thrown = replay
    .round(g.round)
    ?.grenades?.find(
      (x) =>
        x.p === p &&
        (x.type === g.grenade ||
          (g.grenade === "molotov" && x.type === "molotov")) &&
        Math.abs(x.t1 - g.roundTime) <= 0.35,
    );
  return {
    ...(thrown ? { from: { x: thrown.from[0], y: thrown.from[1] } } : {}),
    ...(landing
      ? { landing }
      : thrown
        ? { landing: { x: thrown.to[0], y: thrown.to[1] } }
        : {}),
  };
}

function throwEffect(
  g: GrenadeEvent,
  analysis: Analysis,
  flashes: FlashedEvent[],
  mine: GrenadeEvent[],
): Pick<
  Throw,
  | "enemiesFlashed"
  | "enemyBlindSeconds"
  | "teammatesFlashed"
  | "damage"
  | "teamDamage"
> {
  const team = g.throwerTeam;
  const out = {
    enemiesFlashed: 0,
    enemyBlindSeconds: 0,
    teammatesFlashed: 0,
    damage: 0,
    teamDamage: 0,
  };
  if (g.grenade === "flash")
    for (const f of flashes) {
      if (f.round !== g.round || f.attackerId !== g.throwerId) continue;
      if (Math.abs(f.tick - g.tick) > SAME_TICK || f.victimId === g.throwerId)
        continue;
      if (team && f.victimTeam === team) out.teammatesFlashed++;
      else {
        out.enemiesFlashed++;
        out.enemyBlindSeconds += f.durationSeconds;
      }
    }
  for (const d of eventsOf(analysis, "damage")) {
    if (d.round !== g.round || d.attackerId !== g.throwerId) continue;
    const he = g.grenade === "he" && d.weapon === "HE Grenade";
    const fire =
      g.grenade === "molotov" &&
      MOLOTOV_WEAPONS.has(d.weapon ?? "") &&
      d.roundTime >= g.roundTime - 0.05 &&
      d.roundTime <= g.roundTime + BURN_SECONDS &&
      // the latest own molotov at or before this damage owns it
      !mine.some(
        (o) =>
          o !== g &&
          o.grenade === "molotov" &&
          o.round === g.round &&
          o.roundTime > g.roundTime &&
          o.roundTime <= d.roundTime,
      );
    if (!(he && Math.abs(d.tick - g.tick) <= SAME_TICK) && !fire) continue;
    if (d.victimId === g.throwerId) continue;
    if (team && d.victimTeam === team) out.teamDamage += d.healthDamage;
    else out.damage += d.healthDamage;
  }
  out.enemyBlindSeconds = r2(out.enemyBlindSeconds);
  return out;
}

const verdictOf = (t: Omit<Throw, "verdict">): Throw["verdict"] => {
  if (t.type === "smoke" || t.type === "decoy") return "good";
  if (t.enemiesFlashed > 0 || t.damage > 0) return "good";
  return t.teammatesFlashed > 0 || t.teamDamage > 0 ? "harmful" : "wasted";
};

/** The player's throws with their measured effect. */
export function utilityLog(
  analysis: Analysis,
  steamId: string,
  replay: ReplayIndex,
  callouts: CalloutIndex,
): Throw[] {
  const flashes = (analysis.events ?? []).filter(
    (e): e is FlashedEvent => e.type === "flashed",
  );
  const mine = uniqueGrenades(analysis).filter((g) => g.throwerId === steamId);
  return mine.slice(0, 200).map((g) => {
    const geo = landingOf(g, replay);
    const landingPlace = g.pos
      ? callouts.nearest(g.pos.x, g.pos.y, g.pos.z)
      : geo.landing
        ? callouts.nearest(geo.landing.x, geo.landing.y)
        : undefined;
    const base = {
      eventId: g.id,
      type: g.grenade as Nade,
      round: g.round,
      time: r2(Math.max(0, g.roundTime)),
      ...(cleanPlace(g.place) ? { fromPlace: cleanPlace(g.place)! } : {}),
      ...(landingPlace ? { landingPlace } : {}),
      ...geo,
      ...throwEffect(g, analysis, flashes, mine),
    };
    return { ...base, verdict: verdictOf(base) };
  });
}

function stats(log: Throw[]): DeepUtility["stats"] {
  const of = (t: Nade) => log.filter((g) => g.type === t);
  const fl = of("flash");
  const enemies = fl.reduce((n, g) => n + g.enemiesFlashed, 0);
  const team = fl.reduce((n, g) => n + g.teammatesFlashed, 0);
  const blind = fl.reduce((n, g) => n + g.enemyBlindSeconds, 0);
  const dmg = (list: Throw[]) => list.reduce((n, g) => n + g.damage, 0);
  const smokes = new Map<string, number>();
  for (const s of of("smoke"))
    if (s.landingPlace)
      smokes.set(s.landingPlace, (smokes.get(s.landingPlace) ?? 0) + 1);
  return {
    flash: {
      thrown: fl.length,
      enemiesFlashed: enemies,
      enemiesPerFlash: ratio(enemies, fl.length),
      blindSecondsPerFlash: ratio(blind, fl.length),
      teammatesFlashed: team,
      teamFlashRate: pct(team, team + enemies),
      effectivePct: pct(
        fl.filter((g) => g.enemiesFlashed > 0).length,
        fl.length,
      ),
    },
    he: {
      thrown: of("he").length,
      damage: dmg(of("he")),
      damagePerNade: ratio(dmg(of("he")), of("he").length),
    },
    molotov: {
      thrown: of("molotov").length,
      damage: dmg(of("molotov")),
      damagePerNade: ratio(dmg(of("molotov")), of("molotov").length),
      areaDenialSeconds: null,
    },
    smoke: {
      thrown: of("smoke").length,
      byCallout: [...smokes.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 20)
        .map(([place, count]) => ({ place, count })),
    },
  };
}

/** Deaths with grenades still held (only deaths whose inventory the parser could read). */
function unusedAtDeath(
  analysis: Analysis,
  steamId: string,
): DeepUtility["unusedAtDeath"] {
  const deaths = eventsOf(analysis, "kill").filter(
    (k) => k.victimId === steamId && Array.isArray(k.victimGrenades),
  );
  if (!deaths.length) return undefined;
  const grenades: Partial<Record<Nade, number>> = {};
  for (const d of deaths)
    for (const g of d.victimGrenades!)
      if ((TYPES as string[]).includes(g))
        grenades[g as Nade] = (grenades[g as Nade] ?? 0) + 1;
  return {
    deaths: deaths.length,
    deathsWithUtility: deaths.filter((d) => d.victimGrenades!.length > 0)
      .length,
    grenades: grenades as Record<Nade, number>,
  };
}

/** The utility module and its citable facts. */
export function utilityModule(
  analysis: Analysis,
  steamId: string,
  replay: ReplayIndex,
  callouts: CalloutIndex,
): { utility: DeepUtility; evidence: Evidence[] } {
  const log = utilityLog(analysis, steamId, replay, callouts);
  const s = stats(log);
  const perType = TYPES.map((type) => {
    const list = log.filter((g) => g.type === type);
    const effective = list.filter((g) => g.verdict === "good").length;
    return {
      type,
      thrown: list.length,
      effective,
      damage: list.reduce((n, g) => n + g.damage, 0),
      enemiesFlashed: list.reduce((n, g) => n + g.enemiesFlashed, 0),
      blindSeconds: r2(list.reduce((n, g) => n + g.enemyBlindSeconds, 0)),
      efficiency:
        type === "smoke" || type === "decoy"
          ? null
          : pct(effective, list.length),
    };
  }).filter((t) => t.thrown > 0);
  const unused = unusedAtDeath(analysis, steamId);
  const ids = (type: Nade) =>
    log.filter((g) => g.type === type).map((g) => g.eventId);
  const evidence = defined([
    fact(
      "deep-utility-thrown",
      "deep-utility",
      "Grenades you threw (deduplicated detonations)",
      log.length,
      log.map((g) => g.eventId),
    ),
    fact(
      "deep-flash-enemies-per-flash",
      "deep-utility",
      "Enemies blinded per flash you threw",
      s.flash.enemiesPerFlash,
      ids("flash"),
    ),
    fact(
      "deep-flash-blind-seconds",
      "deep-utility",
      "Enemy blind seconds per flash you threw",
      s.flash.blindSecondsPerFlash,
      ids("flash"),
    ),
    fact(
      "deep-flash-team-rate",
      "deep-utility",
      "Share of players your flashes blinded who were teammates (%)",
      s.flash.teamFlashRate,
      ids("flash"),
    ),
    fact(
      "deep-flash-effective",
      "deep-utility",
      "Flashes that blinded at least one enemy (%)",
      s.flash.effectivePct,
      ids("flash"),
    ),
    fact(
      "deep-he-damage-per-nade",
      "deep-utility",
      "Enemy damage per HE grenade",
      s.he.damagePerNade,
      ids("he"),
    ),
    fact(
      "deep-molotov-damage",
      "deep-utility",
      "Enemy damage from your molotovs/incendiaries",
      s.molotov.thrown ? s.molotov.damage : null,
      ids("molotov"),
    ),
    fact(
      "deep-smokes",
      "deep-utility",
      "Smokes you threw",
      s.smoke.thrown || null,
      ids("smoke"),
    ),
    unused
      ? fact(
          "deep-unused-utility-deaths",
          "deep-utility",
          `Deaths with grenades still in your inventory (of ${unused.deaths} deaths with a readable inventory)`,
          unused.deathsWithUtility,
        )
      : undefined,
  ]);
  const lineupList = lineups(analysis, steamId, log, callouts);
  lineupList.forEach((l, i) => {
    const f = fact(
      `deep-lineup-${i + 1}`,
      l.kind === "learn" ? "place-lineup" : "deep-lineup",
      `${l.kind === "repeat" ? "Effective throw to repeat" : "Lobby utility where you died"}: ${l.why}`,
      l.count,
      l.eventIds,
    );
    if (f) evidence.push(f);
  });
  return {
    utility: {
      thrown: log.length,
      perType,
      stats: s,
      ...(unused ? { unusedAtDeath: unused } : {}),
      grenades: log,
      lineups: lineupList,
      evidenceIds: evidence.map((e) => e.id),
    },
    evidence,
  };
}
