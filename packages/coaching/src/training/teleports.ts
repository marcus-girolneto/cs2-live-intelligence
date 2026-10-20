/**
 * "Go to where you died", "where the enemy was", "repeat your best throws" and crosshair
 * spots: exact demo coordinates turned into setpos_exact/setang lines (no AI). Death and
 * enemy positions are the game's own (kill events); view angles and throw positions come from
 * the replay samples (whole degrees, a few samples per second), so they are marked approximate.
 */
import type { Analysis, DeepReview, DemoEvent, Teleport } from "@cs2/contracts";
import { duelStarts } from "../deep/crosshair.js";
import {
  cleanPlace,
  ReplayIndex,
  uniqueGrenades,
  type DeepTrack,
} from "../deep/common.js";
import {
  anglesBetween,
  EYE_HEIGHT,
  setangCommand,
  setposCommand,
  teleportLine,
  type Angles,
  type Vec3,
} from "./console.js";

type Kill = Extract<DemoEvent, { type: "kill" }>;
const EYE_CROUCHED = 46;
/** Aim a little above the enemy's feet so bot_place lands on the floor at their spot. */
const FEET_AIM = 8;
const MAX_DEATHS = 4;
const MAX_LINEUPS = 3;
const MAX_TEAMFLASH = 2;
const MAX_CROSSHAIR = 3;

const finite = (v: Vec3 | undefined): v is Vec3 =>
  !!v &&
  Number.isFinite(v.x) &&
  Number.isFinite(v.y) &&
  Number.isFinite(v.z) &&
  !(v.x === 0 && v.y === 0 && v.z === 0);
const eyeOf = (feet: Vec3, crouched = false): Vec3 => ({
  ...feet,
  z: feet.z + (crouched ? EYE_CROUCHED : EYE_HEIGHT),
});
const round1 = (n: number) => Math.round(n * 10) / 10;

function teleport(
  base: Omit<Teleport, "setpos" | "setang" | "command" | "x" | "y" | "z">,
  feet: Vec3,
  angles: Angles,
): Teleport {
  const setpos = setposCommand(feet);
  const setang = setangCommand(angles);
  return {
    ...base,
    setpos,
    setang,
    command: teleportLine(setpos, setang),
    x: round1(feet.x),
    y: round1(feet.y),
    z: round1(feet.z),
  };
}

function sampleAt(
  replay: ReplayIndex,
  round: number,
  steamId: string,
  time: number,
  maxGap = 0.5,
): { track: DeepTrack; i: number } | undefined {
  const track = replay.track(round, steamId);
  const i = replay.sampleBefore(round, time, maxGap);
  if (!track || i < 0 || track.z?.[i] === undefined) return undefined;
  return { track, i };
}
const feetOf = (t: DeepTrack, i: number): Vec3 => ({
  x: t.x[i]!,
  y: t.y[i]!,
  z: t.z![i]!,
});

/** Deaths in the danger zones (most deaths first), with the angle you had and the killer. */
function deathTeleports(
  analysis: Analysis,
  steamId: string,
  deep: DeepReview | undefined,
  replay: ReplayIndex,
): Teleport[] {
  const excluded = new Set(
    (deep?.positioning?.deathsDetail ?? [])
      .filter((d) => d.excluded)
      .map((d) => d.eventId),
  );
  const zones = (deep?.positioning?.dangerZones ?? []).map((z) => z.place);
  const deaths = (analysis.events ?? []).filter(
    (e): e is Kill =>
      e.type === "kill" &&
      e.victimId === steamId &&
      !!e.attackerId &&
      e.attackerId !== steamId &&
      e.attackerTeam !== e.victimTeam &&
      finite(e.victimPos) &&
      !excluded.has(e.id),
  );
  const rank = (k: Kill) => {
    const i = zones.indexOf(cleanPlace(k.victimPlace) ?? "");
    return i < 0 ? zones.length : i;
  };
  const picked = [...deaths]
    .sort((a, b) => rank(a) - rank(b) || a.round - b.round)
    .slice(0, MAX_DEATHS);
  const out: Teleport[] = [];
  for (const k of picked) {
    const callout = cleanPlace(k.victimPlace);
    const time = (k as { roundTime?: number }).roundTime;
    const s =
      time === undefined
        ? undefined
        : sampleAt(replay, k.round, steamId, time + 0.01);
    const crouched = !!s?.track.duck?.[s.i];
    const killer = finite(k.attackerPos) ? k.attackerPos : undefined;
    const fromReplay = s && s.track.pitch?.[s.i] !== undefined;
    const angles: Angles | undefined = fromReplay
      ? { pitch: s.track.pitch![s.i]!, yaw: s.track.yaw[s.i]! }
      : killer
        ? anglesBetween(eyeOf(k.victimPos!), eyeOf(killer))
        : undefined;
    if (!angles) continue;
    const where = callout ? ` at ${callout}` : "";
    out.push(
      teleport(
        {
          id: `death-${k.id}`,
          kind: "death",
          label: `Round ${k.round}: where you died${where}`,
          round: k.round,
          ...(callout ? { callout } : {}),
          ...(crouched ? { crouched } : {}),
          ...(fromReplay ? { approximate: true } : {}),
        },
        k.victimPos!,
        angles,
      ),
    );
    if (!killer) continue;
    const enemyCallout = cleanPlace(k.attackerPlace);
    const look = anglesBetween(eyeOf(k.victimPos!), {
      ...killer,
      z: killer.z + FEET_AIM,
    });
    out.push(
      teleport(
        {
          id: `enemy-${k.id}`,
          kind: "enemy",
          label: `Round ${k.round}: where the enemy was${enemyCallout ? ` (${enemyCallout})` : ""}`,
          round: k.round,
          ...(enemyCallout ? { callout: enemyCallout } : {}),
          botPlace: `${teleportLine(setposCommand(k.victimPos!), setangCommand(look))}; bot_place`,
        },
        killer,
        anglesBetween(eyeOf(killer), eyeOf(k.victimPos!)),
      ),
    );
  }
  return out;
}

/** Your best throws (to repeat) and your worst team flashes (to fix), from the replay. */
function throwTeleports(
  analysis: Analysis,
  steamId: string,
  deep: DeepReview | undefined,
  replay: ReplayIndex,
): Teleport[] {
  const log = deep?.utility?.grenades ?? [];
  if (!log.length || !replay.available) return [];
  const p = replay.playerIndex(steamId);
  const events = new Map(
    uniqueGrenades(analysis)
      .filter((g) => g.throwerId === steamId)
      .map((g) => [g.id, g]),
  );
  const impact = (t: (typeof log)[number]) =>
    t.enemyBlindSeconds + t.damage / 10;
  const best = log
    .filter((t) => t.verdict === "good" && t.type !== "decoy")
    .filter((t) => t.type !== "smoke" || t.landingPlace)
    .sort((a, b) => impact(b) - impact(a) || a.round - b.round)
    .filter(
      (t, i, all) =>
        all.findIndex(
          (o) => o.type === t.type && o.landingPlace === t.landingPlace,
        ) === i,
    );
  const worst = log
    .filter((t) => t.type === "flash" && t.teammatesFlashed > 0)
    .sort((a, b) => b.teammatesFlashed - a.teammatesFlashed)
    .slice(0, MAX_TEAMFLASH);
  const out: Teleport[] = [];
  const add = (t: (typeof log)[number], kind: "lineup" | "teamflash") => {
    const g = events.get(t.eventId);
    if (!g || p === undefined) return false;
    const thrown = replay
      .round(t.round)
      ?.grenades?.find(
        (x) =>
          x.p === p &&
          x.type === t.type &&
          Math.abs(x.t1 - g.roundTime) <= 0.35,
      );
    if (!thrown) return false;
    const s = sampleAt(replay, t.round, steamId, thrown.t0 + 0.01);
    if (!s || s.track.pitch?.[s.i] === undefined) return false;
    const target = t.landingPlace ? ` into ${t.landingPlace}` : "";
    const name = t.type === "he" ? "HE" : t.type;
    out.push(
      teleport(
        {
          id: `${kind}-${t.eventId}`,
          kind,
          label:
            kind === "lineup"
              ? `Round ${t.round}: your ${name}${target}`
              : `Round ${t.round}: ${name}${target} that blinded ${t.teammatesFlashed} teammate${t.teammatesFlashed === 1 ? "" : "s"}`,
          round: t.round,
          grenade: t.type,
          ...(t.landingPlace ? { callout: t.landingPlace } : {}),
          ...(s.track.duck?.[s.i] ? { crouched: true } : {}),
          approximate: true,
        },
        feetOf(s.track, s.i),
        { pitch: s.track.pitch![s.i]!, yaw: s.track.yaw[s.i]! },
      ),
    );
    return true;
  };
  let lineups = 0;
  for (const t of best)
    if (lineups < MAX_LINEUPS && add(t, "lineup")) lineups++;
  // A flash already shown as a lineup to repeat is not listed again as a team flash.
  const shown = new Set(out.map((t) => t.id.replace(/^lineup-/, "")));
  for (const t of worst) if (!shown.has(t.eventId)) add(t, "teamflash");
  return out;
}

/** Angle between a view and the direction from `from` to `to`, degrees (internal only). */
function offTarget(view: Angles, from: Vec3, to: Vec3): number {
  const want = anglesBetween(from, to);
  const dir = (a: Angles) => [
    Math.cos(a.pitch * RAD) * Math.cos(a.yaw * RAD),
    Math.cos(a.pitch * RAD) * Math.sin(a.yaw * RAD),
    -Math.sin(a.pitch * RAD),
  ];
  const a = dir(view);
  const b = dir(want);
  const dot = a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
  return Math.acos(Math.max(-1, Math.min(1, dot))) / RAD;
}
const RAD = Math.PI / 180;
/** Crosshair counted as on target below this angle (same rule as the deep module). */
export const ON_TARGET_DEGREES = 5;

export type MeasuredDuel = {
  id: string;
  round: number;
  callout?: string;
  off: number;
  feet: Vec3;
  angles: Angles;
};
/** Duel starts measured from the replay: your view vs the direction to the enemy. */
export function measuredDuels(
  analysis: Analysis,
  steamId: string,
  replay: ReplayIndex,
): MeasuredDuel[] {
  if (!replay.available) return [];
  const out: MeasuredDuel[] = [];
  for (const c of duelStarts(analysis, steamId)) {
    const me = sampleAt(replay, c.round, steamId, c.roundTime, 0.3);
    const enemy = sampleAt(replay, c.round, c.enemy, c.roundTime, 0.3);
    if (!me || !enemy || me.track.pitch?.[me.i] === undefined) continue;
    if (!me.track.alive[me.i] || !enemy.track.alive[enemy.i]) continue;
    const feet = feetOf(me.track, me.i);
    const eye = eyeOf(feet, !!me.track.duck?.[me.i]);
    const target = eyeOf(
      feetOf(enemy.track, enemy.i),
      !!enemy.track.duck?.[enemy.i],
    );
    const distance = Math.hypot(
      target.x - eye.x,
      target.y - eye.y,
      target.z - eye.z,
    );
    if (distance < 100 || distance > 4000) continue;
    const view = { pitch: me.track.pitch[me.i]!, yaw: me.track.yaw[me.i]! };
    const callout = cleanPlace(
      c.attackerId === steamId
        ? c.attackerPlace
        : c.type === "kill"
          ? c.victimPlace
          : undefined,
    );
    out.push({
      id: c.id,
      round: c.round,
      ...(callout ? { callout } : {}),
      off: offTarget(view, eye, target),
      feet,
      // Standing at the spot: the angle from your standing eyes to where the enemy appeared.
      angles: anglesBetween(eyeOf(feet), target),
    });
  }
  return out;
}

/** Duel starts where your crosshair was off target: the angle where the enemy appeared. */
function crosshairTeleports(duels: MeasuredDuel[]): Teleport[] {
  return duels
    .filter((d) => d.callout && d.off >= ON_TARGET_DEGREES)
    .sort((a, b) => b.off - a.off)
    .filter((d, i, all) => all.findIndex((o) => o.callout === d.callout) === i)
    .slice(0, MAX_CROSSHAIR)
    .map((d) =>
      teleport(
        {
          id: `crosshair-${d.id}`,
          kind: "crosshair",
          label: `Round ${d.round}: ${d.callout}, this is where your crosshair should have been`,
          round: d.round,
          ...(d.callout ? { callout: d.callout } : {}),
          approximate: true,
        },
        d.feet,
        d.angles,
      ),
    );
}

export function buildTeleports(
  analysis: Analysis,
  steamId: string,
  deep: DeepReview | undefined,
  replay: ReplayIndex,
): Teleport[] {
  return [
    ...deathTeleports(analysis, steamId, deep, replay),
    ...throwTeleports(analysis, steamId, deep, replay),
    ...crosshairTeleports(measuredDuels(analysis, steamId, replay)),
  ].slice(0, 16);
}
