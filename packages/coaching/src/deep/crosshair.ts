/**
 * Deep module: crosshair placement. At the start of each duel (the first damage or kill
 * between the player and one enemy, split when 3 s pass without contact) it measures the angle
 * between the player's view and the direction to that enemy, from the last replay sample
 * before the player's first shot of the duel (or before the first contact when the enemy shot
 * first). Eye height is 64 units standing / 46 crouched for both players.
 */
import type { Analysis, DeepCrosshair, Evidence } from "@cs2/contracts";
import {
  CalloutIndex,
  cleanPlace,
  defined,
  duelWeapon,
  eventsOf,
  fact,
  mean,
  median,
  pct,
  placeKey,
  r1,
  r2,
  ReplayIndex,
  type DeepTrack,
  type Timed,
} from "./common.js";

type Duel = DeepCrosshair["samples"][number];
/** Contact more than this many seconds after the previous one starts a new duel. */
export const DUEL_GAP = 3;
/** The player's first shot counts when it is at most this long before/after first contact. */
const SHOT_BEFORE = 1.5;
const SHOT_AFTER = 1;
const MIN_DISTANCE = 100;
const MAX_DISTANCE = 4000;
export const PRE_AIM_DEGREES = 5;
const EYE = 64;
const EYE_CROUCHED = 46;
const BINS: [number, number | null][] = [
  [0, 2.5],
  [2.5, 5],
  [5, 10],
  [10, 20],
  [20, 45],
  [45, null],
];
const RAD = Math.PI / 180;

/** Wraps an angle difference to -180..180. */
export const wrap = (deg: number): number =>
  ((((deg + 180) % 360) + 360) % 360) - 180;

/**
 * Offsets of a view (yaw, pitch in the game's convention: positive pitch = looking down)
 * against the direction from `from` to `to` (world units, z up).
 */
export function aimOffset(
  view: { yaw: number; pitch: number },
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
): {
  yaw: number;
  pitch: number;
  pitchError: number;
  total: number;
  distance: number;
} {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const flat = Math.hypot(dx, dy);
  const wantYaw = Math.atan2(dy, dx) / RAD;
  const wantPitch = -Math.atan2(dz, flat) / RAD;
  const yaw = wrap(view.yaw - wantYaw);
  // Positive = crosshair above the target (a smaller game pitch looks higher).
  const pitchError = wantPitch - view.pitch;
  const dir = (yawDeg: number, pitchDeg: number) => [
    Math.cos(pitchDeg * RAD) * Math.cos(yawDeg * RAD),
    Math.cos(pitchDeg * RAD) * Math.sin(yawDeg * RAD),
    -Math.sin(pitchDeg * RAD),
  ];
  const a = dir(view.yaw, view.pitch);
  const b = dir(wantYaw, wantPitch);
  const dot = Math.max(
    -1,
    Math.min(1, a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!),
  );
  return {
    yaw: Math.abs(yaw),
    pitch: Math.abs(pitchError),
    pitchError,
    total: Math.acos(dot) / RAD,
    distance: Math.hypot(dx, dy, dz),
  };
}

type Contact = (
  Extract<Timed, { type: "damage" }> | Extract<Timed, { type: "kill" }>
) & {
  enemy: string;
};

/** First contacts of each duel between the player and one enemy. */
export function duelStarts(analysis: Analysis, steamId: string): Contact[] {
  const contacts: Contact[] = [];
  for (const e of [
    ...eventsOf(analysis, "damage"),
    ...eventsOf(analysis, "kill"),
  ]) {
    if (!duelWeapon(e.weapon)) continue;
    if (
      e.attackerId === steamId &&
      e.victimId !== steamId &&
      e.victimTeam !== e.attackerTeam
    )
      contacts.push({ ...e, enemy: e.victimId });
    else if (
      e.victimId === steamId &&
      e.attackerId &&
      e.attackerId !== steamId &&
      e.attackerTeam !== e.victimTeam
    )
      contacts.push({ ...e, enemy: e.attackerId });
  }
  contacts.sort(
    (a, b) => a.round - b.round || a.roundTime - b.roundTime || a.tick - b.tick,
  );
  const last = new Map<string, number>();
  const starts: Contact[] = [];
  for (const c of contacts) {
    const key = `${c.round}|${c.enemy}`;
    const prev = last.get(key);
    if (prev === undefined || c.roundTime - prev > DUEL_GAP) starts.push(c);
    last.set(key, c.roundTime);
  }
  return starts;
}

const eye = (t: DeepTrack, i: number) => ({
  x: t.x[i]!,
  y: t.y[i]!,
  z: (t.z?.[i] ?? 0) + (t.duck?.[i] ? EYE_CROUCHED : EYE),
});

/** Measured duels (needs replay samples with pitch and height). */
export function measureDuels(
  analysis: Analysis,
  steamId: string,
  replay: ReplayIndex,
  callouts: CalloutIndex,
): { duels: number; samples: Duel[] } {
  const starts = duelStarts(analysis, steamId);
  const shots = eventsOf(analysis, "shot").filter(
    (s) => s.shooterId === steamId,
  );
  const kills = eventsOf(analysis, "kill");
  const samples: Duel[] = [];
  for (const c of starts) {
    const first = shots.find(
      (s) =>
        s.round === c.round &&
        s.roundTime >= c.roundTime - SHOT_BEFORE &&
        s.roundTime <= c.roundTime + SHOT_AFTER,
    );
    const at = Math.min(first?.roundTime ?? c.roundTime, c.roundTime);
    const i = replay.sampleBefore(c.round, at);
    const me = replay.track(c.round, steamId);
    const enemy = replay.track(c.round, c.enemy);
    if (
      i < 0 ||
      !me ||
      !enemy ||
      me.pitch?.[i] === undefined ||
      me.z?.[i] === undefined ||
      enemy.z?.[i] === undefined
    )
      continue;
    if (!me.alive[i] || !enemy.alive[i]) continue;
    const o = aimOffset(
      { yaw: me.yaw[i]!, pitch: me.pitch[i]! },
      eye(me, i),
      eye(enemy, i),
    );
    if (o.distance < MIN_DISTANCE || o.distance > MAX_DISTANCE) continue;
    const place =
      cleanPlace(
        c.attackerId === steamId
          ? c.attackerPlace
          : c.type === "kill"
            ? c.victimPlace
            : undefined,
      ) ?? callouts.nearest(me.x[i]!, me.y[i]!, me.z?.[i]);
    const outcome = kills.find(
      (k) =>
        k.round === c.round &&
        k.roundTime >= c.roundTime &&
        k.roundTime <= c.roundTime + DUEL_GAP + 2 &&
        ((k.attackerId === steamId && k.victimId === c.enemy) ||
          (k.attackerId === c.enemy && k.victimId === steamId)),
    );
    samples.push({
      eventId: c.id,
      round: c.round,
      time: r2(Math.max(0, c.roundTime)),
      enemyId: c.enemy,
      ...(place ? { place } : {}),
      yawOffset: r1(o.yaw),
      pitchOffset: r1(o.pitch),
      offset: r1(o.total),
      pitchError: r1(o.pitchError),
      distance: Math.round(o.distance),
      ...(outcome ? { won: outcome.attackerId === steamId } : {}),
    });
  }
  return { duels: starts.length, samples };
}

/** The crosshair module (undefined without replay angles) and its citable facts. */
export function crosshairModule(
  analysis: Analysis,
  steamId: string,
  replay: ReplayIndex,
  callouts: CalloutIndex,
): { crosshair: DeepCrosshair; evidence: Evidence[] } | undefined {
  if (!replay.hasAngles) return undefined;
  const { duels, samples } = measureDuels(analysis, steamId, replay, callouts);
  const offsets = samples.map((s) => s.offset);
  const bias = mean(samples.map((s) => s.pitchError));
  const ids = samples.map((s) => s.eventId);
  const byPlace = new Map<string, Duel[]>();
  for (const s of samples)
    if (s.place) byPlace.set(s.place, [...(byPlace.get(s.place) ?? []), s]);
  const worst = [...byPlace.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([place, list]) => ({
      place,
      medianOffset: r1(median(list.map((s) => s.offset))!),
      duels: list.length,
      ids: list.map((s) => s.eventId),
    }))
    .sort(
      (a, b) =>
        b.medianOffset - a.medianOffset || a.place.localeCompare(b.place),
    )
    .slice(0, 5);
  const medianOffset = median(offsets);
  const preAimed = pct(
    offsets.filter((o) => o < PRE_AIM_DEGREES).length,
    offsets.length,
  );
  const evidence = defined([
    fact(
      "deep-crosshair-duels",
      "deep-crosshair",
      "Duels measured for crosshair placement (replay sample before your first shot)",
      samples.length || null,
      ids,
    ),
    fact(
      "deep-crosshair-median-offset",
      "deep-crosshair",
      "Median angle between your crosshair and the enemy at the start of a duel (degrees)",
      medianOffset === null ? null : r1(medianOffset),
      ids,
    ),
    fact(
      "deep-crosshair-preaimed",
      "deep-crosshair",
      `Duels started with the crosshair within ${PRE_AIM_DEGREES} degrees of the enemy (%)`,
      preAimed,
      ids,
    ),
    fact(
      "deep-crosshair-pitch-bias",
      "deep-crosshair",
      "Mean vertical crosshair error at duel start (degrees, negative = below the enemy's head height)",
      bias === null ? null : r1(bias),
      ids,
    ),
    ...worst.map((w) =>
      fact(
        `deep-crosshair-place-${placeKey(w.place)}`,
        "place-crosshair",
        `Median crosshair offset at ${w.place} over ${w.duels} duels (degrees)`,
        w.medianOffset,
        w.ids,
      ),
    ),
  ]);
  return {
    crosshair: {
      duels,
      measured: samples.length,
      medianOffset: medianOffset === null ? null : r1(medianOffset),
      medianYawOffset: samples.length
        ? r1(median(samples.map((s) => s.yawOffset))!)
        : null,
      medianPitchOffset: samples.length
        ? r1(median(samples.map((s) => s.pitchOffset))!)
        : null,
      preAimedPct: preAimed,
      pitchBias: bias === null ? null : r1(bias),
      pitchTendency:
        bias === null
          ? null
          : bias < -2
            ? "too_low"
            : bias > 2
              ? "too_high"
              : "level",
      histogram: BINS.map(([from, to]) => ({
        from,
        to,
        count: offsets.filter((o) => o >= from && (to === null || o < to))
          .length,
      })),
      worstCallouts: worst.map(({ place, medianOffset: m, duels: d }) => ({
        place,
        medianOffset: m,
        duels: d,
      })),
      samples: samples.slice(0, 80),
      evidenceIds: evidence.map((e) => e.id),
    },
    evidence,
  };
}
