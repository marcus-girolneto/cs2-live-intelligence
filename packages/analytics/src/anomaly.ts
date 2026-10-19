import type {
  Aim,
  DemoEvent,
  IntegrityPlayer,
  NormalizedDemo,
} from "@cs2/contracts";

/**
 * Match integrity signals: deterministic, per-match statistics that make unusual play explicit
 * to the uploader without accusing anyone. Thresholds are deliberately conservative and were
 * calibrated so that every player of the public fixture and of a real 23-round Dust2 match
 * scores "none" (docs/INTEGRITY.md). A signal only counts with enough samples (`n`).
 *
 * Not measured: pre-aiming through walls or cover needs map geometry (visibility), which the
 * demo does not provide, so it is never claimed.
 */
export const INTEGRITY_THRESHOLDS = {
  /** Snap: peak angular speed in the last 100 ms before the first shot (deg/s). */
  snapPeakDegPerSec: 1500,
  /** Snap: angle travelled in those 100 ms (degrees). */
  snapMinDistanceDeg: 20,
  /** Snap: crosshair ends within this angle of the victim's head–chest line (degrees). */
  snapMaxOffsetDeg: 1,
  snapWindowSeconds: 0.1,
  /** Inhuman snaps needed (and share of the player's measured engagements). */
  snapMinCount: 2,
  snapMinShare: 0.1,
  snapMinEngagements: 10,
  /** One-sided binomial z-score against the rest of the lobby. */
  zScore: 4,
  headshotMinKills: 15,
  headHitsMinShots: 100,
  /** Median seconds from being hit to the first hit back on that attacker. */
  reactionMaxMedianSeconds: 0.15,
  reactionMinSamples: 10,
  reactionWindowSeconds: 1,
  smokeWallMinKills: 12,
  smokeWallMinRatio: 0.3,
} as const;

type Reason = IntegrityPlayer["reasons"][number];
type Combat = Extract<DemoEvent, { type: "kill" | "damage" }>;
const T = INTEGRITY_THRESHOLDS;

const round = (v: number, digits = 2): number => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};
/** Signed shortest difference of two angles (degrees, -180..180). */
export function angleDelta(a: number, b: number): number {
  return ((((a - b + 180) % 360) + 360) % 360) - 180;
}

/** Measurements of one aim window (exported for tests and docs). */
export function snapOf(
  aim: Aim,
  tickRate: number,
): { peak: number; distance: number; offset: number } | undefined {
  const n = aim.dt.length;
  if (n < 2 || aim.yaw.length !== n || aim.pitch.length !== n || tickRate <= 0)
    return undefined;
  const from = -Math.round(T.snapWindowSeconds * tickRate);
  let first = aim.dt.findIndex((dt) => dt >= from);
  if (first < 0) first = n - 1;
  // The sample just before the window is the reference, so motion entering it counts.
  const s0 = Math.max(0, first - 1);
  let peak = 0;
  for (let i = s0 + 1; i < n; i++) {
    const seconds = (aim.dt[i]! - aim.dt[i - 1]!) / tickRate;
    if (seconds <= 0) continue;
    const step = Math.hypot(
      angleDelta(aim.yaw[i]!, aim.yaw[i - 1]!),
      aim.pitch[i]! - aim.pitch[i - 1]!,
    );
    peak = Math.max(peak, step / seconds);
  }
  const last = n - 1;
  const distance = Math.hypot(
    angleDelta(aim.yaw[last]!, aim.yaw[s0]!),
    aim.pitch[last]! - aim.pitch[s0]!,
  );
  const pitch = aim.pitch[last]!;
  const [lo, hi] = [
    Math.min(aim.targetPitch, aim.bodyPitch),
    Math.max(aim.targetPitch, aim.bodyPitch),
  ];
  const pitchOff = pitch < lo ? lo - pitch : pitch > hi ? pitch - hi : 0;
  const offset = Math.hypot(
    angleDelta(aim.yaw[last]!, aim.targetYaw),
    pitchOff,
  );
  return { peak, distance, offset };
}

/** One-sided binomial z-score of k successes in n trials against rate p0. */
export function binomialZ(k: number, n: number, p0: number): number {
  if (n <= 0 || p0 <= 0 || p0 >= 1) return 0;
  return (k - n * p0) / Math.sqrt(n * p0 * (1 - p0));
}

function lobbyZ(
  counts: Map<string, { k: number; n: number }>,
  steamId: string,
): { rate: number; z: number; n: number } {
  const own = counts.get(steamId) ?? { k: 0, n: 0 };
  let k = 0;
  let n = 0;
  for (const [id, c] of counts)
    if (id !== steamId) {
      k += c.k;
      n += c.n;
    }
  const p0 = n ? k / n : 0;
  return {
    rate: own.n ? own.k / own.n : 0,
    z: binomialZ(own.k, own.n, p0),
    n: own.n,
  };
}

function bump(
  map: Map<string, { k: number; n: number }>,
  id: string,
  hit: boolean,
): void {
  const c = map.get(id) ?? { k: 0, n: 0 };
  c.n++;
  if (hit) c.k++;
  map.set(id, c);
}

const median = (values: number[]): number => {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

function opposing(e: Combat): boolean {
  return (
    !!e.attackerId &&
    e.attackerId !== e.victimId &&
    !!e.attackerTeam &&
    !!e.victimTeam &&
    e.attackerTeam !== e.victimTeam
  );
}

/** Per-player integrity level and reasons for one demo (deterministic, ordered by steamId). */
export function integritySignals(demo: NormalizedDemo): IntegrityPlayer[] {
  const rate = demo.tickRate ?? 64;
  const combat = demo.events.filter(
    (e): e is Combat =>
      (e.type === "kill" || e.type === "damage") && opposing(e),
  );
  const kills = combat.filter((e) => e.type === "kill");
  const headshots = new Map<string, { k: number; n: number }>();
  const smokeWall = new Map<string, { k: number; n: number }>();
  for (const k of kills) {
    bump(headshots, k.attackerId!, k.type === "kill" && k.headshot);
    bump(
      smokeWall,
      k.attackerId!,
      k.type === "kill" && (k.throughSmoke === true || k.penetrated === true),
    );
  }
  const headHits = new Map<string, { k: number; n: number }>();
  for (const e of demo.events)
    if (e.type === "shot") bump(headHits, e.shooterId, false);
  for (const e of combat)
    if (e.type === "damage" && e.hitgroup === "head") {
      const c = headHits.get(e.attackerId!);
      if (c) c.k++;
    }
  const snaps = new Map<string, { k: number; n: number }>();
  for (const e of combat) {
    if (!e.aim) continue;
    const s = snapOf(e.aim, rate);
    if (!s) continue;
    bump(
      snaps,
      e.attackerId!,
      s.peak >= T.snapPeakDegPerSec &&
        s.distance >= T.snapMinDistanceDeg &&
        s.offset < T.snapMaxOffsetDeg,
    );
  }
  const reactions = reactionTimes(combat, demo.events, rate);
  const ids = [...new Set(demo.players.map((p) => p.steamId))].sort();
  return ids.map((steamId) => {
    const reasons: Reason[] = [];
    const snap = snaps.get(steamId);
    if (
      snap &&
      snap.n >= T.snapMinEngagements &&
      snap.k >= T.snapMinCount &&
      snap.k / snap.n >= T.snapMinShare
    )
      reasons.push({
        code: "inhuman_snaps",
        value: snap.k,
        threshold: T.snapMinCount,
        n: snap.n,
      });
    const hs = lobbyZ(headshots, steamId);
    if (hs.n >= T.headshotMinKills && hs.z >= T.zScore)
      reasons.push({
        code: "headshot_rate",
        value: round(hs.z),
        threshold: T.zScore,
        n: hs.n,
      });
    const hh = lobbyZ(headHits, steamId);
    if (hh.n >= T.headHitsMinShots && hh.z >= T.zScore)
      reasons.push({
        code: "head_hits_per_shot",
        value: round(hh.z),
        threshold: T.zScore,
        n: hh.n,
      });
    const times = reactions.get(steamId) ?? [];
    if (
      times.length >= T.reactionMinSamples &&
      median(times) < T.reactionMaxMedianSeconds
    )
      reasons.push({
        code: "reaction_time",
        value: round(median(times), 3),
        threshold: T.reactionMaxMedianSeconds,
        n: times.length,
      });
    const sw = lobbyZ(smokeWall, steamId);
    if (
      sw.n >= T.smokeWallMinKills &&
      sw.rate >= T.smokeWallMinRatio &&
      sw.z >= T.zScore
    )
      reasons.push({
        code: "smoke_wall_kills",
        value: round(sw.rate),
        threshold: T.smokeWallMinRatio,
        n: sw.n,
      });
    const level =
      reasons.length >= 3
        ? "high"
        : reasons.length === 2
          ? "elevated"
          : reasons.length === 1
            ? "low"
            : "none";
    return { steamId, level, reasons };
  });
}

/**
 * Reaction proxy: for each first hit a player receives from an attacker (per round and pair)
 * while that player had not fired for the previous second (not already in a firefight), the
 * seconds until the player first damages that attacker back (within 1 s).
 */
function reactionTimes(
  combat: Combat[],
  events: DemoEvent[],
  rate: number,
): Map<string, number[]> {
  const sorted = [...combat].sort((a, b) => a.tick - b.tick);
  const shots = new Map<string, number[]>();
  for (const e of events)
    if (e.type === "shot") {
      const list = shots.get(e.shooterId) ?? [];
      list.push(e.tick);
      shots.set(e.shooterId, list);
    }
  const firedBefore = (id: string, tick: number): boolean =>
    (shots.get(id) ?? []).some((t) => t <= tick && t > tick - rate);
  const seen = new Set<string>();
  const out = new Map<string, number[]>();
  for (let i = 0; i < sorted.length; i++) {
    const hit = sorted[i]!;
    if (hit.type !== "damage") continue;
    const key = `${hit.round}|${hit.attackerId}|${hit.victimId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (firedBefore(hit.victimId, hit.tick)) continue;
    const limit = hit.tick + T.reactionWindowSeconds * rate;
    for (let j = i + 1; j < sorted.length && sorted[j]!.tick <= limit; j++) {
      const back = sorted[j]!;
      if (
        back.type === "damage" &&
        back.attackerId === hit.victimId &&
        back.victimId === hit.attackerId
      ) {
        const list = out.get(hit.victimId) ?? [];
        list.push((back.tick - hit.tick) / rate);
        out.set(hit.victimId, list);
        break;
      }
    }
  }
  return out;
}
