import type {
  DemoEvent,
  Evidence,
  NormalizedDemo,
  PlayerDetail,
  PlayerRound,
} from "@cs2/contracts";

type Kill = Extract<DemoEvent, { type: "kill" }>;
type Damage = Extract<DemoEvent, { type: "damage" }>;
type Shot = Extract<DemoEvent, { type: "shot" }>;
type Grenade = Extract<DemoEvent, { type: "grenade" }>;
type Flashed = Extract<DemoEvent, { type: "flashed" }>;
type Side = "CT" | "T";
type Hitgroup = keyof NonNullable<PlayerDetail["hitgroups"]>;
type Economy = NonNullable<NormalizedDemo["rounds"][number]["economy"]>[number];

/** Firearms as named by the parser (cs2live.2). Knife, Zeus, grenades and C4 are not guns. */
export const GUNS = new Set([
  "Glock-18",
  "P2000",
  "USP-S",
  "P250",
  "Desert Eagle",
  "Five-SeveN",
  "Dual Berettas",
  "Tec-9",
  "CZ75 Auto",
  "R8 Revolver",
  "MP7",
  "MP9",
  "PP-Bizon",
  "MAC-10",
  "UMP-45",
  "P90",
  "MP5-SD",
  "Sawed-Off",
  "Nova",
  "MAG-7",
  "XM1014",
  "M249",
  "Negev",
  "Galil AR",
  "FAMAS",
  "AK-47",
  "M4A4",
  "M4A1-S",
  "SSG 08",
  "SG 553",
  "AUG",
  "AWP",
  "SCAR-20",
  "G3SG1",
]);
export const UTILITY_DAMAGE_WEAPONS = new Set([
  "HE Grenade",
  "Molotov",
  "Incendiary Grenade",
]);
/** Deaths before this many seconds after freeze time count as early deaths. */
export const EARLY_DEATH_SECONDS = 20;
/** Own freeze-time equipment value thresholds for buy types. */
export const ECO_BELOW = 1500;
export const FORCE_BELOW = { T: 3500, CT: 4000 } as const;

const isSide = (t: unknown): t is Side => t === "CT" || t === "T";
const enemy = (e: Kill | Damage | Flashed) =>
  e.attackerId !== undefined &&
  e.attackerId !== e.victimId &&
  isSide(e.attackerTeam) &&
  isSide(e.victimTeam) &&
  e.attackerTeam !== e.victimTeam;
const finite = (n: number | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n);
const r2 = (n: number) => Math.round(n * 100) / 100;
const mean = (xs: number[]) =>
  xs.length ? r2(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
/** Map/weapon names come from game data; keep evidence text to a safe character set. */
export const clean = (s: string) =>
  s.replace(/[^A-Za-z0-9 _.+-]/g, "").slice(0, 64);
/** Callout names are single tokens in game data (e.g. "TopofMid"); anything else is dropped. */
export const cleanPlace = (s: string) =>
  s.replace(/[^A-Za-z0-9_]/g, "").slice(0, 32);
export const slug = (s: string) =>
  clean(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "unknown";

/** What enrichment the demo carries; each detail section is emitted only when its data exists. */
export function enrichment(demo: NormalizedDemo) {
  let shots = false,
    killWeapon = false,
    hitgroups = false,
    places = false,
    timing = false,
    grenades = false;
  for (const e of demo.events) {
    if (e.type === "shot") shots = true;
    else if (e.type === "grenade" || e.type === "flashed") grenades = true;
    else if (e.type === "kill") {
      if (e.weapon) killWeapon = true;
      if (e.victimPlace || e.attackerPlace) places = true;
      if (finite(e.roundTime)) timing = true;
    } else if (e.type === "damage" && e.hitgroup) hitgroups = true;
  }
  const economy = demo.rounds.some((r) => (r.economy?.length ?? 0) > 0);
  // Utility counts are meaningful (including zero) once the parser emits grenade-level data.
  const utility = shots || grenades;
  return { shots, killWeapon, hitgroups, places, timing, utility, economy };
}
export type Enrichment = ReturnType<typeof enrichment>;

/**
 * Pistol rounds: round 1, plus the first round after a side swap whose economy shows only
 * starting money (equipment + money <= $1200 for every sampled player). Overtime halves also
 * swap sides but start with full money, so they are not pistol rounds.
 */
export function pistolRounds(
  demo: NormalizedDemo,
  sides: Map<number, Map<string, Side>>,
) {
  const out = new Set<number>();
  const ordered = [...demo.rounds].sort((a, b) => a.number - b.number);
  if (ordered[0]?.number === 1) out.add(1);
  for (let i = 1; i < ordered.length; i++) {
    const prev = sides.get(ordered[i - 1]!.number);
    const cur = sides.get(ordered[i]!.number);
    if (!prev || !cur || ordered[i]!.number !== ordered[i - 1]!.number + 1)
      continue;
    let same = 0,
      swapped = 0;
    for (const [id, side] of cur) {
      const before = prev.get(id);
      if (before === side) same++;
      else if (before) swapped++;
    }
    const economy = ordered[i]!.economy ?? [];
    const starting =
      economy.length > 0 &&
      economy.every((r) => r.equipmentValue + (r.money ?? 0) <= 1200);
    if (swapped > same && starting) out.add(ordered[i]!.number);
  }
  return out;
}

export function buyType(
  row: Economy | undefined,
  side: Side | undefined,
  pistol: boolean,
): PlayerRound["buyType"] {
  if (pistol) return "pistol";
  if (!row) return undefined;
  const s = isSide(row.team) ? row.team : side;
  if (row.equipmentValue < ECO_BELOW) return "eco";
  if (row.equipmentValue < FORCE_BELOW[s ?? "CT"]) return "force";
  return "full";
}

/** Average freeze-time equipment value per side for a round. */
function teamValues(economy: Economy[] | undefined) {
  const acc = { CT: [] as number[], T: [] as number[] };
  for (const r of economy ?? [])
    if (isSide(r.team)) acc[r.team].push(r.equipmentValue);
  return { CT: mean(acc.CT), T: mean(acc.T) };
}

export type DetailResult = {
  detail?: PlayerDetail;
  /** Extra per-round fields keyed by round number. */
  roundExtras: Map<number, Partial<PlayerRound>>;
  /** Raw numerators/denominators and cited event ids for the 1.2 metrics. */
  raw: {
    shots: number;
    hitShots: number;
    hitIds: string[];
    gunHits: number;
    headHits: number;
    headIds: string[];
    utilityDamage: number;
    utilityIds: string[];
    enemiesFlashed: number;
    flashIds: string[];
    flashAssistIds: string[];
    openingTimes: number[];
    openingIds: string[];
    deathTimes: number[];
    deathIds: string[];
    earlyDeathIds: string[];
    antiEcoRounds: number;
    antiEcoWon: number;
    antiEcoIds: string[];
    killDistances: number[];
    distanceIds: string[];
  };
  /** Citable breakdown facts (weapons, places, hit groups, utility, economy). */
  evidence: Omit<Evidence, "id">[];
};

/**
 * Detailed breakdowns for one player from enriched events (parser cs2live.2+).
 *
 * Definitions:
 * - shots: gun trigger pulls (`shot` events).
 * - hits: damage events from guns on enemies (one per bullet/pellet that hurt an enemy);
 *   `hitgroups` sums to `hits`. Shotgun pellets and wallbangs through several enemies can
 *   produce several hits per shot, so hits/shots is not accuracy.
 * - accuracy (metric): shots that hurt at least one enemy, counted as distinct
 *   (tick, weapon) pairs among those hits, divided by shots; capped at 100%.
 */
export function playerDetail(
  demo: NormalizedDemo,
  sides: Map<number, Map<string, Side>>,
  steamId: string,
  flags: Enrichment,
  pistols: Set<number>,
): DetailResult {
  const own = new Set(
    demo.rounds
      .filter((r) => r.participants.includes(steamId))
      .map((r) => r.number),
  );
  const roundExtras = new Map<number, Partial<PlayerRound>>();
  const raw: DetailResult["raw"] = {
    shots: 0,
    hitShots: 0,
    hitIds: [],
    gunHits: 0,
    headHits: 0,
    headIds: [],
    utilityDamage: 0,
    utilityIds: [],
    enemiesFlashed: 0,
    flashIds: [],
    flashAssistIds: [],
    openingTimes: [],
    openingIds: [],
    deathTimes: [],
    deathIds: [],
    earlyDeathIds: [],
    antiEcoRounds: 0,
    antiEcoWon: 0,
    antiEcoIds: [],
    killDistances: [],
    distanceIds: [],
  };
  const evidence: DetailResult["evidence"] = [];
  const any =
    flags.shots ||
    flags.killWeapon ||
    flags.hitgroups ||
    flags.places ||
    flags.timing ||
    flags.utility ||
    flags.economy;
  if (!any || own.size === 0) return { roundExtras, raw, evidence };

  const events = demo.events.filter((e) => own.has(e.round));
  const shotWeapons = new Set(
    demo.events.flatMap((e) => (e.type === "shot" ? [e.weapon] : [])),
  );
  const gun = (w: string | undefined) =>
    !!w && (GUNS.has(w) || shotWeapons.has(w));
  const extra = (round: number) => {
    const row = roundExtras.get(round) ?? {};
    roundExtras.set(round, row);
    return row;
  };

  const kills: Kill[] = [];
  const deaths: Kill[] = [];
  const damage: Damage[] = [];
  const shots: Shot[] = [];
  const nades: Grenade[] = [];
  const flashes: Flashed[] = [];
  const byRoundKills = new Map<number, Kill[]>();
  for (const e of events) {
    if (e.type === "kill") {
      const list = byRoundKills.get(e.round) ?? [];
      list.push(e);
      byRoundKills.set(e.round, list);
      if (e.attackerId === steamId && enemy(e)) kills.push(e);
      if (e.victimId === steamId) deaths.push(e);
    } else if (e.type === "damage") {
      if (e.attackerId === steamId && enemy(e)) damage.push(e);
    } else if (e.type === "shot") {
      if (e.shooterId === steamId) shots.push(e);
    } else if (e.type === "grenade") {
      if (e.throwerId === steamId) nades.push(e);
    } else if (e.type === "flashed") {
      if (e.attackerId === steamId) flashes.push(e);
    }
  }
  for (const list of byRoundKills.values())
    list.sort((a, b) => a.tick - b.tick);
  const detail: PlayerDetail = {};

  // Shots, hits, accuracy.
  const gunHits = damage.filter((d) => gun(d.weapon));
  if (flags.shots) {
    const hitKeys = new Set<string>();
    for (const d of gunHits) {
      const key = `${d.tick}|${d.weapon}`;
      if (!hitKeys.has(key)) {
        hitKeys.add(key);
        raw.hitIds.push(d.id);
      }
    }
    raw.shots = shots.length;
    raw.hitShots = Math.min(hitKeys.size, shots.length);
    raw.gunHits = gunHits.length;
    detail.shots = shots.length;
    detail.hits = gunHits.length;
    for (const s of shots) {
      const row = extra(s.round);
      row.shots = (row.shots ?? 0) + 1;
    }
    for (const round of own) {
      const row = extra(round);
      row.shots ??= 0;
      row.hits = gunHits.filter((d) => d.round === round).length;
    }
  }

  // Hit groups (gun damage on enemies only).
  if (flags.hitgroups) {
    const groups: Partial<Record<Hitgroup, number>> = {};
    for (const d of gunHits)
      if (d.hitgroup) groups[d.hitgroup] = (groups[d.hitgroup] ?? 0) + 1;
    detail.hitgroups = groups as Record<Hitgroup, number>;
    const head = gunHits.filter((d) => d.hitgroup === "head");
    raw.headHits = head.length;
    raw.headIds = head.map((d) => d.id);
    const total = gunHits.filter((d) => d.hitgroup).length;
    if (total > 0) {
      const g = (k: Hitgroup) => groups[k] ?? 0;
      const legs = g("left_leg") + g("right_leg");
      const arms = g("left_arm") + g("right_arm");
      const low = legs + g("stomach");
      evidence.push({
        kind: "hitgroups",
        description: `gun hits on enemies by body part: head ${g("head")}, neck ${g("neck")}, chest ${g("chest")}, stomach ${g("stomach")}, arms ${arms}, legs ${legs}, other ${g("generic")} (total ${total}; stomach+legs ${Math.round((100 * low) / total)}%)`,
        value: r2((100 * low) / total),
        eventIds: gunHits.filter((d) => d.hitgroup).map((d) => d.id),
      });
    }
  }

  // Weapons table.
  if (flags.killWeapon || flags.shots) {
    const table = new Map<
      string,
      {
        weapon: string;
        kills: number;
        headshots: number;
        damage: number;
        shots: number;
        hits: number;
        hitKeys: Set<string>;
        ids: string[];
      }
    >();
    const row = (w: string | undefined) => {
      const name = clean(w || "Unknown") || "Unknown";
      let r = table.get(name);
      if (!r) {
        r = {
          weapon: name,
          kills: 0,
          headshots: 0,
          damage: 0,
          shots: 0,
          hits: 0,
          hitKeys: new Set(),
          ids: [],
        };
        table.set(name, r);
      }
      return r;
    };
    for (const k of kills) {
      const r = row(k.weapon);
      r.kills++;
      if (k.headshot) r.headshots++;
      r.ids.push(k.id);
    }
    for (const d of damage) {
      const r = row(d.weapon);
      r.damage += d.healthDamage;
      if (gun(d.weapon)) {
        r.hits++;
        r.hitKeys.add(`${d.tick}|${d.weapon}`);
      }
    }
    for (const s of shots) row(s.weapon).shots++;
    const list = [...table.values()].sort(
      (a, b) =>
        b.kills - a.kills ||
        b.damage - a.damage ||
        b.shots - a.shots ||
        a.weapon.localeCompare(b.weapon),
    );
    detail.weapons = list.slice(0, 64).map((r) => ({
      weapon: r.weapon,
      kills: r.kills,
      headshots: r.headshots,
      damage: r.damage,
      shots: r.shots,
      hits: r.hits,
    }));
    for (const r of list.slice(0, 12)) {
      const hitShots = Math.min(r.hitKeys.size, r.shots);
      const acc = r.shots > 0 ? r2((100 * hitShots) / r.shots) : undefined;
      if (r.shots === 0 && r.kills === 0) continue;
      evidence.push({
        kind: `weapon-${slug(r.weapon)}`,
        description:
          `${r.weapon}: ${r.kills} kills (${r.headshots} headshots), ${r.damage} damage to enemies` +
          (r.shots > 0
            ? `, ${hitShots} of ${r.shots} shots hit an enemy (${acc}% accuracy)`
            : ""),
        ...(acc !== undefined ? { value: acc } : { value: r.kills }),
        eventIds: r.ids,
      });
    }
  }

  // Callouts.
  if (flags.places) {
    const places = new Map<
      string,
      {
        kills: number;
        deaths: number;
        damage: number;
        early: number;
        ids: string[];
      }
    >();
    const at = (p: string | undefined) => {
      const name = p ? cleanPlace(p) : "";
      if (!name) return undefined;
      let r = places.get(name);
      if (!r) {
        r = { kills: 0, deaths: 0, damage: 0, early: 0, ids: [] };
        places.set(name, r);
      }
      return r;
    };
    for (const k of kills) {
      const r = at(k.attackerPlace);
      if (r) {
        r.kills++;
        r.ids.push(k.id);
      }
    }
    for (const d of deaths) {
      const r = at(d.victimPlace);
      if (r) {
        r.deaths++;
        r.ids.push(d.id);
        if (finite(d.roundTime) && d.roundTime < EARLY_DEATH_SECONDS) r.early++;
      }
    }
    for (const d of damage) {
      const r = at(d.attackerPlace);
      if (r) r.damage += d.healthDamage;
    }
    const list = [...places.entries()].sort(
      ([an, a], [bn, b]) =>
        b.deaths + b.kills - (a.deaths + a.kills) ||
        b.damage - a.damage ||
        an.localeCompare(bn),
    );
    detail.places = list.slice(0, 200).map(([place, r]) => ({
      place,
      kills: r.kills,
      deaths: r.deaths,
      damage: r.damage,
    }));
    for (const [place, r] of list.slice(0, 8)) {
      if (r.kills + r.deaths === 0) continue;
      evidence.push({
        kind: `place-${slug(place)}`,
        description: `${place}: ${r.kills} kills made from here, ${r.deaths} of your ${deaths.length} deaths here (${r.early} within the first ${EARLY_DEATH_SECONDS} s), ${r.damage} damage dealt from here`,
        value: r.deaths,
        eventIds: r.ids,
      });
    }
    const positions: NonNullable<PlayerDetail["positions"]> = [];
    for (const k of kills)
      if (k.attackerPos)
        positions.push({
          kind: "kill",
          round: k.round,
          x: k.attackerPos.x,
          y: k.attackerPos.y,
          ...(k.attackerPlace ? { place: cleanPlace(k.attackerPlace) } : {}),
          ...(k.weapon ? { weapon: clean(k.weapon) } : {}),
          headshot: k.headshot,
          eventId: k.id,
        });
    for (const d of deaths)
      if (d.victimPos)
        positions.push({
          kind: "death",
          round: d.round,
          x: d.victimPos.x,
          y: d.victimPos.y,
          ...(d.victimPlace ? { place: cleanPlace(d.victimPlace) } : {}),
          ...(d.weapon ? { weapon: clean(d.weapon) } : {}),
          headshot: d.headshot,
          eventId: d.id,
        });
    if (positions.length) detail.positions = positions.slice(0, 2000);
  }

  // Timing.
  if (flags.timing) {
    const firstKillTimes: number[] = [];
    for (const list of byRoundKills.values()) {
      const first = list[0];
      if (
        first &&
        finite(first.roundTime) &&
        ((first.attackerId === steamId && enemy(first)) ||
          first.victimId === steamId)
      ) {
        raw.openingTimes.push(first.roundTime);
        raw.openingIds.push(first.id);
      }
      const mine = list.find((k) => k.attackerId === steamId && enemy(k));
      if (mine && finite(mine.roundTime)) firstKillTimes.push(mine.roundTime);
    }
    for (const d of deaths) {
      const row = extra(d.round);
      if (d.victimPlace) row.deathPlace = cleanPlace(d.victimPlace);
      if (!finite(d.roundTime)) continue;
      row.deathTime = d.roundTime;
      raw.deathTimes.push(d.roundTime);
      raw.deathIds.push(d.id);
      if (d.roundTime < EARLY_DEATH_SECONDS) raw.earlyDeathIds.push(d.id);
    }
    detail.timing = {
      avgOpeningTime: mean(raw.openingTimes),
      avgDeathTime: mean(raw.deathTimes),
      avgFirstKillTime: mean(firstKillTimes),
      earlyDeaths: raw.earlyDeathIds.length,
    };
    for (const k of kills)
      if (finite(k.distance)) {
        raw.killDistances.push(k.distance);
        raw.distanceIds.push(k.id);
      }
    detail.avgKillDistance = mean(raw.killDistances);
  } else if (flags.places)
    for (const d of deaths)
      if (d.victimPlace) extra(d.round).deathPlace = cleanPlace(d.victimPlace);

  // Utility.
  if (flags.utility) {
    const count = (g: Grenade["grenade"]) =>
      nades.filter((n) => n.grenade === g).length;
    const enemyFlashes = flashes.filter((f) => enemy(f));
    const teamFlashes = flashes.filter(
      (f) =>
        f.victimId !== steamId &&
        isSide(f.attackerTeam) &&
        f.attackerTeam === f.victimTeam,
    );
    const util = damage.filter(
      (d) => d.weapon && UTILITY_DAMAGE_WEAPONS.has(d.weapon),
    );
    const flashAssists = events.filter(
      (e): e is Kill =>
        e.type === "kill" &&
        e.assisterId === steamId &&
        e.flashAssist === true &&
        enemy(e),
    );
    raw.enemiesFlashed = enemyFlashes.length;
    raw.flashIds = enemyFlashes.map((f) => f.id);
    raw.utilityDamage = util.reduce((n, d) => n + d.healthDamage, 0);
    raw.utilityIds = util.map((d) => d.id);
    raw.flashAssistIds = flashAssists.map((k) => k.id);
    detail.utility = {
      flashes: count("flash"),
      smokes: count("smoke"),
      hes: count("he"),
      molotovs: count("molotov"),
      enemiesFlashed: enemyFlashes.length,
      teammatesFlashed: teamFlashes.length,
      enemyBlindSeconds: r2(
        enemyFlashes.reduce((n, f) => n + f.durationSeconds, 0),
      ),
      flashAssists: flashAssists.length,
      utilityDamage: raw.utilityDamage,
    };
    const u = detail.utility;
    evidence.push({
      kind: "utility",
      description: `grenades used in ${own.size} rounds: ${u.flashes} flashes, ${u.smokes} smokes, ${u.hes} HE, ${u.molotovs} molotovs; ${u.enemiesFlashed} enemies flashed (${u.enemyBlindSeconds} s total), ${u.teammatesFlashed} teammates flashed, ${u.flashAssists} flash assists, ${u.utilityDamage} utility damage`,
      value: u.flashes + u.smokes + u.hes + u.molotovs,
      eventIds: nades.map((n) => n.id),
    });
  }

  // Economy.
  if (flags.economy) {
    const values: number[] = [];
    const buys = { eco: 0, force: 0, full: 0, pistol: 0 };
    let antiEcoKills = 0;
    const kByRound = new Map<number, Kill[]>();
    for (const k of kills) {
      const list = kByRound.get(k.round) ?? [];
      list.push(k);
      kByRound.set(k.round, list);
    }
    for (const round of demo.rounds) {
      if (!own.has(round.number) || !round.economy?.length) continue;
      const mine = round.economy.find((r) => r.steamId === steamId);
      const side =
        sides.get(round.number)?.get(steamId) ??
        (isSide(mine?.team) ? mine.team : undefined);
      const pistol = pistols.has(round.number);
      const type = buyType(mine, side, pistol);
      const row = extra(round.number);
      if (mine) {
        values.push(mine.equipmentValue);
        row.equipmentValue = mine.equipmentValue;
      }
      if (type) {
        row.buyType = type;
        buys[type]++;
      }
      // Kills on an enemy who started the round on an eco while you had at least $1000 more.
      for (const k of kByRound.get(round.number) ?? []) {
        const victim = round.economy.find((r) => r.steamId === k.victimId);
        if (
          !pistol &&
          mine &&
          victim &&
          victim.equipmentValue < ECO_BELOW &&
          mine.equipmentValue >= victim.equipmentValue + 1000
        )
          antiEcoKills++;
      }
      // Anti-eco round: your side out-equipped an enemy side that was on an eco.
      const team = teamValues(round.economy);
      if (side && !pistol && round.winner) {
        const us = team[side];
        const them = team[side === "CT" ? "T" : "CT"];
        if (
          us !== null &&
          them !== null &&
          them < ECO_BELOW &&
          us >= them + 1500
        ) {
          raw.antiEcoRounds++;
          if (round.winner === side) raw.antiEcoWon++;
          const end = demo.events.find(
            (e) => e.type === "round_end" && e.round === round.number,
          );
          if (end) raw.antiEcoIds.push(end.id);
        }
      }
    }
    const avg = mean(values);
    detail.economy = {
      avgEquipmentValue: avg === null ? null : Math.round(avg),
      buys,
      antiEcoKills,
    };
    evidence.push({
      kind: "economy",
      description: `buy types at freeze-time end: ${buys.pistol} pistol, ${buys.eco} eco, ${buys.force} force, ${buys.full} full buys; average equipment value ${avg === null ? "unknown" : `$${Math.round(avg)}`}; ${antiEcoKills} kills on eco enemies; anti-eco rounds won ${raw.antiEcoWon} of ${raw.antiEcoRounds}`,
      ...(avg !== null ? { value: Math.round(avg) } : {}),
      eventIds: raw.antiEcoIds,
    });
  }

  return {
    ...(Object.keys(detail).length ? { detail } : {}),
    roundExtras,
    raw,
    evidence,
  };
}
