import { createHash } from "node:crypto";
import {
  normalizedDemoSchema,
  analysisSchema,
  type Analysis,
  type DemoEvent,
  type Evidence,
} from "@cs2/contracts";
import { playerAdvanced, resolveSides } from "./advanced.js";
import { enrichment, pistolRounds, playerDetail, slug } from "./detail.js";
export { TRADE_TICKS } from "./advanced.js";
export { EARLY_DEATH_SECONDS, ECO_BELOW, FORCE_BELOW, GUNS } from "./detail.js";
export const METRIC_VERSION = "1.2.0";
const metricId = (steamId: string, kind: string) =>
  `metric-${createHash("sha256").update(steamId).digest("hex").slice(0, 16)}-${kind}`;
function opposing(event: Extract<DemoEvent, { type: "kill" | "damage" }>) {
  return (
    event.attackerId !== event.victimId &&
    ((event.attackerTeam === "CT" && event.victimTeam === "T") ||
      (event.attackerTeam === "T" && event.victimTeam === "CT"))
  );
}
/** Deterministic demo-only metrics. Null values explicitly abstain when evidence is incomplete. */
export function analyzeDemo(input: unknown): Analysis {
  const demo = normalizedDemoSchema.parse(input);
  const ids = new Set<string>();
  for (const event of demo.events) {
    if (ids.has(event.id)) throw new Error("Duplicate event ID");
    ids.add(event.id);
  }
  const playerIds = new Set(demo.players.map((p) => p.steamId));
  if (playerIds.size !== demo.players.length)
    throw new Error("Duplicate player ID");
  const roundIds = new Set(demo.rounds.map((r) => r.number));
  if (roundIds.size !== demo.rounds.length)
    throw new Error("Duplicate round number");
  for (const round of demo.rounds)
    if (
      new Set(round.participants).size !== round.participants.length ||
      round.participants.some((p) => !playerIds.has(p))
    )
      throw new Error("Invalid round participants");
  const outside = demo.events.some((e) => !roundIds.has(e.round));
  // Identity and participation checks cover the combat events behind the core metrics.
  const combat = demo.events.filter(
    (e): e is Extract<DemoEvent, { type: "kill" | "damage" }> =>
      e.type === "kill" || e.type === "damage",
  );
  const unknownIdentity = combat.some(
    (e) =>
      !playerIds.has(e.victimId) ||
      !e.victimTeam ||
      (e.attackerId !== undefined &&
        (!playerIds.has(e.attackerId) || !e.attackerTeam)),
  );
  const participants = new Map(
    demo.rounds.map((r) => [r.number, new Set(r.participants)]),
  );
  const contradictoryParticipants = combat.some(
    (e) =>
      !participants.get(e.round)?.has(e.victimId) ||
      (e.attackerId !== undefined &&
        !participants.get(e.round)?.has(e.attackerId)),
  );
  const complete =
    demo.complete &&
    demo.completeness.rounds &&
    !outside &&
    !contradictoryParticipants &&
    demo.rounds.length > 0;
  const killsComplete = complete && demo.completeness.kills && !unknownIdentity;
  const damageComplete =
    complete &&
    demo.completeness.damage &&
    demo.completeness.rounds &&
    !unknownIdentity;
  const evidence: Evidence[] = [];
  const caveats: string[] = [];
  if (!complete)
    caveats.push(
      "The demo has incomplete round coverage or inconsistent event participation. Metrics abstain.",
    );
  if (unknownIdentity)
    caveats.push(
      "Some attacker, victim or team identities are unresolved. Combat metrics abstain.",
    );
  if (!demo.completeness.damage)
    caveats.push("Damage coverage is incomplete; ADR is unavailable.");
  if (!demo.completeness.kills)
    caveats.push(
      "Kill coverage is incomplete; kill, death and headshot metrics are unavailable.",
    );
  const sides = resolveSides(demo);
  const flags = enrichment(demo);
  const pistols = pistolRounds(demo, sides);
  if (flags.economy)
    caveats.push(
      "Economy is sampled when freeze time ends; items bought later in the buy period are not included.",
    );
  const players = demo.players.map((player) => {
    const ownRounds = new Set(
      demo.rounds
        .filter((r) => r.participants.includes(player.steamId))
        .map((r) => r.number),
    );
    const ownEvents = demo.events.filter((e) => ownRounds.has(e.round));
    const kills = ownEvents.filter(
      (e): e is Extract<DemoEvent, { type: "kill" }> =>
        e.type === "kill" && e.attackerId === player.steamId && opposing(e),
    );
    const deaths = ownEvents.filter(
      (e) => e.type === "kill" && e.victimId === player.steamId,
    );
    const damage = ownEvents.filter(
      (e): e is Extract<DemoEvent, { type: "damage" }> =>
        e.type === "damage" && e.attackerId === player.steamId && opposing(e),
    );
    function metric(
      kind: string,
      numerator: number,
      denominator: number,
      coverage: boolean,
      formula: string,
      eventIds: string[],
      scale = 1,
    ) {
      const id = metricId(player.steamId, kind);
      const valid = coverage && ownRounds.size > 0;
      const value =
        valid && denominator > 0
          ? Math.round(((scale * numerator) / denominator) * 100) / 100
          : null;
      evidence.push({
        id,
        kind,
        description: `${kind}: ${numerator} / ${denominator}; complete=${valid}`,
        eventIds,
        ...(value !== null ? { value } : {}),
      });
      return {
        value,
        numerator,
        denominator,
        complete: valid,
        formula,
        evidenceIds: [id],
      };
    }
    const adv = playerAdvanced(demo, sides, player.steamId);
    const extra = playerDetail(demo, sides, player.steamId, flags, pistols);
    const rows = adv.rows.map((r) => ({
      ...r,
      ...extra.roundExtras.get(r.round),
    }));
    const sum = (
      list: typeof rows,
      pick: (r: (typeof rows)[number]) => number,
    ) => list.reduce((n, r) => n + pick(r), 0);
    const won = rows.filter((r) => r.won === true);
    const lost = rows.filter((r) => r.won === false);
    const ct = rows.filter((r) => r.side === "CT");
    const t = rows.filter((r) => r.side === "T");
    const openings = rows.filter((r) => r.opening).length;
    const deathsCount = rows.filter((r) => r.died).length;
    const sidesOk = adv.sidesComplete;
    const advanced = {
      "opening-kills": metric(
        "opening-kills",
        adv.ids.openingKills.length,
        1,
        killsComplete,
        "rounds where you got the first kill of the round",
        adv.ids.openingKills,
      ),
      "opening-deaths": metric(
        "opening-deaths",
        adv.ids.openingDeaths.length,
        1,
        killsComplete,
        "rounds where you were the first player to die",
        adv.ids.openingDeaths,
      ),
      "opening-success": metric(
        "opening-success",
        adv.ids.openingKills.length,
        openings,
        killsComplete,
        "100 * opening kills / opening duels taken",
        [...adv.ids.openingKills, ...adv.ids.openingDeaths],
        100,
      ),
      "trade-kills": metric(
        "trade-kills",
        adv.ids.tradeKills.length,
        1,
        killsComplete,
        "kills on an enemy within 5 s (320 ticks at 64 tick) of that enemy killing a teammate",
        adv.ids.tradeKills,
      ),
      "traded-deaths": metric(
        "traded-deaths",
        rows.filter((r) => r.traded).length,
        deathsCount,
        killsComplete,
        "100 * deaths avenged by a teammate within 5 s / deaths",
        adv.ids.tradedDeaths,
        100,
      ),
      kast: metric(
        "kast",
        rows.filter((r) => r.kills > 0 || r.damageAssist || !r.died || r.traded)
          .length,
        rows.length,
        killsComplete && damageComplete,
        "100 * rounds with a Kill, damage Assist, Survival or being Traded / rounds",
        [],
        100,
      ),
      survival: metric(
        "survival",
        rows.filter((r) => !r.died).length,
        rows.length,
        killsComplete,
        "100 * rounds survived / rounds",
        [],
        100,
      ),
      "multi-kill-rounds": metric(
        "multi-kill-rounds",
        rows.filter((r) => r.kills >= 2).length,
        1,
        killsComplete,
        "rounds with two or more enemy kills",
        adv.ids.multiKills,
      ),
      "clutch-wins": metric(
        "clutch-wins",
        adv.clutchWins,
        adv.clutchAttempts,
        killsComplete && adv.clutchComplete,
        "100 * clutch rounds won / rounds where you were last alive against at least one enemy",
        adv.ids.clutches,
        100,
      ),
      "adr-won": metric(
        "adr-won",
        sum(won, (r) => r.damage),
        won.length,
        damageComplete && sidesOk,
        "enemy health damage in rounds your side won / rounds won",
        adv.ids.damageWon,
      ),
      "adr-lost": metric(
        "adr-lost",
        sum(lost, (r) => r.damage),
        lost.length,
        damageComplete && sidesOk,
        "enemy health damage in rounds your side lost / rounds lost",
        adv.ids.damageLost,
      ),
      "adr-ct": metric(
        "adr-ct",
        sum(ct, (r) => r.damage),
        ct.length,
        damageComplete && sidesOk,
        "enemy health damage on the CT side / CT rounds",
        adv.ids.damageCT,
      ),
      "adr-t": metric(
        "adr-t",
        sum(t, (r) => r.damage),
        t.length,
        damageComplete && sidesOk,
        "enemy health damage on the T side / T rounds",
        adv.ids.damageT,
      ),
      "zero-damage-rounds": metric(
        "zero-damage-rounds",
        rows.filter((r) => r.damage === 0).length,
        1,
        damageComplete,
        "rounds where you dealt no damage to enemies",
        [],
      ),
    };
    // Metric version 1.2: only present when the demo carries the underlying enrichment.
    const x = extra.raw;
    const enriched: Record<string, ReturnType<typeof metric>> = {};
    if (flags.shots)
      enriched.accuracy = metric(
        "accuracy",
        x.hitShots,
        x.shots,
        damageComplete,
        "100 * gun shots that hurt at least one enemy (distinct tick and weapon, so shotgun pellets and multi-hit wallbangs count once) / gun shots fired",
        x.hitIds,
        100,
      );
    if (flags.hitgroups)
      enriched["headshot-hit-rate"] = metric(
        "headshot-hit-rate",
        x.headHits,
        x.gunHits,
        damageComplete,
        "100 * gun hits on enemies that landed on the head / gun hits on enemies",
        x.headIds,
        100,
      );
    if (flags.utility) {
      enriched["utility-damage-per-round"] = metric(
        "utility-damage-per-round",
        x.utilityDamage,
        ownRounds.size,
        damageComplete,
        "enemy health damage from HE grenades and molotovs/incendiaries / participated rounds",
        x.utilityIds,
      );
      enriched["enemies-flashed-per-round"] = metric(
        "enemies-flashed-per-round",
        x.enemiesFlashed,
        ownRounds.size,
        complete,
        "living enemies blinded by your flashbangs / participated rounds",
        x.flashIds,
      );
      enriched["flash-assists"] = metric(
        "flash-assists",
        x.flashAssistIds.length,
        1,
        killsComplete,
        "enemy kills credited with your flash assist",
        x.flashAssistIds,
      );
    }
    if (flags.timing) {
      const total = (xs: number[]) =>
        Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;
      enriched["avg-opening-time"] = metric(
        "avg-opening-time",
        total(x.openingTimes),
        x.openingTimes.length,
        killsComplete,
        "mean seconds after freeze time of the opening duels you took part in (first kill of the round, as killer or victim)",
        x.openingIds,
      );
      enriched["avg-death-time"] = metric(
        "avg-death-time",
        total(x.deathTimes),
        x.deathTimes.length,
        killsComplete,
        "mean seconds after freeze time at which you died",
        x.deathIds,
      );
      enriched["early-deaths"] = metric(
        "early-deaths",
        x.earlyDeathIds.length,
        1,
        killsComplete,
        "deaths in the first 20 seconds after freeze time",
        x.earlyDeathIds,
      );
      enriched["avg-kill-distance"] = metric(
        "avg-kill-distance",
        total(x.killDistances),
        x.killDistances.length,
        killsComplete,
        "mean distance in meters between you and the enemies you killed",
        x.distanceIds,
      );
    }
    if (flags.economy)
      enriched["anti-eco-win-rate"] = metric(
        "anti-eco-win-rate",
        x.antiEcoWon,
        x.antiEcoRounds,
        complete,
        "100 * anti-eco rounds won / anti-eco rounds (non-pistol rounds where the enemy side averaged under $1500 equipment and yours at least $1500 more, at freeze-time end)",
        x.antiEcoIds,
        100,
      );
    // Citable breakdown facts (weapon accuracy, callouts, hit groups, utility, economy).
    const breakdownIds: string[] = [];
    for (const item of extra.evidence) {
      const id = metricId(player.steamId, item.kind);
      if (breakdownIds.includes(id)) continue;
      breakdownIds.push(id);
      const { value, ...rest } = item;
      // Breakdown facts are only citable (carry a value) when round coverage is complete.
      evidence.push({
        id,
        ...rest,
        ...(complete && value !== undefined && Number.isFinite(value)
          ? { value }
          : {}),
      });
    }
    const byKind = (kind: string) => {
      const id = metricId(player.steamId, kind);
      return breakdownIds.includes(id) ? { evidenceId: id } : {};
    };
    const detail = extra.detail
      ? {
          ...extra.detail,
          ...(extra.detail.weapons
            ? {
                weapons: extra.detail.weapons.map((w) => ({
                  ...w,
                  ...byKind(`weapon-${slug(w.weapon)}`),
                })),
              }
            : {}),
          ...(extra.detail.places
            ? {
                places: extra.detail.places.map((pl) => ({
                  ...pl,
                  ...byKind(`place-${slug(pl.place)}`),
                })),
              }
            : {}),
          ...(breakdownIds.length ? { evidenceIds: breakdownIds } : {}),
        }
      : undefined;
    return {
      steamId: player.steamId,
      ...(player.name ? { name: player.name } : {}),
      advanced: { ...advanced, ...enriched },
      rounds: rows,
      ...(detail ? { detail } : {}),
      kills: metric(
        "kills",
        kills.length,
        1,
        killsComplete,
        "enemy kills in observed participated complete rounds",
        kills.map((e) => e.id),
      ),
      deaths: metric(
        "deaths",
        deaths.length,
        1,
        killsComplete,
        "all deaths in observed participated complete rounds",
        deaths.map((e) => e.id),
      ),
      adr: metric(
        "adr",
        damage.reduce((n, e) => n + e.healthDamage, 0),
        ownRounds.size,
        damageComplete,
        "enemy health damage / participated complete rounds",
        damage.map((e) => e.id),
      ),
      headshotPercentage: metric(
        "headshot-percentage",
        kills.filter((e) => e.headshot).length,
        kills.length,
        killsComplete,
        "100 * headshot enemy kills / enemy kills",
        kills.filter((e) => e.headshot).map((e) => e.id),
        100,
      ),
    };
  });
  return analysisSchema.parse({
    schemaVersion: "1.0",
    source: "demo",
    ...(demo.map ? { map: demo.map } : {}),
    provenance: {
      parserVersion: demo.parserVersion,
      metricVersion: METRIC_VERSION,
    },
    roundOutcomes: demo.rounds.map((r) => ({
      round: r.number,
      ...(r.winner ? { winner: r.winner } : {}),
    })),
    events: demo.events,
    players,
    evidence,
    caveats,
  });
}
