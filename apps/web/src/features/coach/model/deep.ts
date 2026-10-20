/**
 * View model of a Deep review (coaching.deep): utility lab, crosshair placement,
 * positioning, round table and history compare. Every field is optional and validated.
 */
import { parseClip } from "@/features/replay";
import { finite, text } from "@/shared/format";
import { parseHistory } from "./history";
import { arr, first, num, obj, opt, pct, point, strs } from "./parse";

import type {
  Bin,
  DangerZone,
  DeepCrosshair,
  DeepPositioning,
  DeepReview,
  DeepUtility,
  Lineup,
  NadeStat,
  NadeThrow,
  NadeType,
  RoundRow,
} from "./deepTypes";

export type * from "./deepTypes";
export { trendOf } from "./history";

const NADES: Record<string, NadeType> = {
  flash: "flash",
  flashbang: "flash",
  smoke: "smoke",
  smokegrenade: "smoke",
  he: "he",
  hegrenade: "he",
  grenade: "he",
  molotov: "molotov",
  incendiary: "molotov",
  incgrenade: "molotov",
  incendiarygrenade: "molotov",
  molotovgrenade: "molotov",
  smokegrenadeprojectile: "smoke",
  decoygrenade: "decoy",
  fire: "molotov",
  decoy: "decoy",
};
export function nadeType(v: unknown): NadeType | null {
  const s = text(v)
    ?.toLowerCase()
    .replace(/[^a-z]/g, "");
  return s ? (NADES[s] ?? null) : null;
}
const count = (v: unknown) => {
  const n = finite(v);
  return n === null ? null : Math.max(0, n);
};

function parseThrow(raw: unknown): NadeThrow | null {
  const o = obj(raw);
  const type = o && nadeType(first(o, ["type", "grenade", "kind"]));
  if (!o || !type) return null;
  const v = text(first(o, ["verdict", "outcome", "quality"]));
  const landing = point(first(o, ["landing", "land", "position", "to"]));
  const from = point(first(o, ["from", "throwFrom", "origin"]));
  const clip = parseClip(o.clip);
  return {
    round: finite(o.round),
    type,
    time: num(o, ["time", "t"]),
    ...opt("place", text(first(o, ["place", "callout", "target"]))),
    ...opt("landing", landing),
    ...opt("from", from),
    ...opt("result", text(first(o, ["result", "effect", "note"]))),
    damage: count(first(o, ["damage", "utilityDamage"])),
    enemiesFlashed: count(first(o, ["enemiesFlashed", "flashed"])),
    verdict:
      v === "good" || v === "wasted" || v === "harmful"
        ? v
        : v === "bad"
          ? "wasted"
          : null,
    ...opt("clip", clip),
  };
}

function parseStat(raw: unknown, key?: string): NadeStat | null {
  const o = obj(raw);
  const type = nadeType(key ?? (o && first(o, ["type", "grenade"])));
  if (!o || !type) return null;
  const thrown = count(first(o, ["thrown", "count", "used"]));
  if (thrown === null) return null;
  return {
    type,
    thrown,
    effective: count(first(o, ["effective", "good", "useful"])),
    damage: count(o.damage),
    enemiesFlashed: count(o.enemiesFlashed),
    blindSeconds: count(first(o, ["blindSeconds", "enemyBlindSeconds"])),
    efficiency: pct(first(o, ["efficiency", "effectiveness"])),
  };
}

function parseUtility(raw: unknown): DeepUtility | undefined {
  const o = obj(raw);
  if (!o) return undefined;
  const throws = arr(first(o, ["grenades", "throws", "log"]))
    .map(parseThrow)
    .filter((x): x is NadeThrow => !!x);
  const pt = first(o, ["perType", "byType", "types"]);
  const perType = (
    obj(pt)
      ? Object.entries(obj(pt)!).map(([k, v]) => parseStat(v, k))
      : arr(pt).map((v) => parseStat(v))
  ).filter((x): x is NadeStat => !!x);
  const lineups = arr(first(o, ["lineups", "lineupsToLearn", "learn"]))
    .map((l): Lineup | null => {
      const x = obj(l);
      // "title"/"why" are English text for the model; the UI writes its own (deepText.ts).
      if (!x) return null;
      const type = nadeType(first(x, ["type", "grenade"]));
      if (!type) return null;
      return {
        kind: x.kind === "repeat" || x.kind === "learn" ? x.kind : null,
        type,
        ...opt("place", text(first(x, ["place", "map", "target"]))),
        ...opt("fromPlace", text(x.fromPlace)),
        round: count(x.round),
        count: count(x.count),
        enemiesFlashed: count(x.enemiesFlashed),
        blindSeconds: num(x, ["blindSeconds"]),
        damage: count(x.damage),
        deathsThere: count(x.deathsThere),
        ...opt("howTo", text(first(x, ["howTo", "how", "instructions"]))),
        ...opt("clip", parseClip(x.clip)),
      };
    })
    .filter((x): x is Lineup => !!x);
  if (!throws.length && !perType.length && !lineups.length) return undefined;
  return {
    ...opt("summary", text(o.summary)),
    efficiency: pct(first(o, ["efficiency", "score"])),
    throws,
    perType,
    lineups,
  };
}

function parseCrosshair(raw: unknown): DeepCrosshair | undefined {
  const o = obj(raw);
  if (!o) return undefined;
  const p = text(first(o, ["pitch", "pitchTendency", "tendency"]));
  const bias = num(o, ["pitchBias", "pitchBiasDeg", "verticalOffset"]);
  const pitch =
    p === "low" || p === "too_low"
      ? "low"
      : p === "high" || p === "too_high"
        ? "high"
        : p === "level" || p === "ok"
          ? "level"
          : bias !== null
            ? bias < -1
              ? "low"
              : bias > 1
                ? "high"
                : "level"
            : null;
  const histogram = arr(first(o, ["histogram", "distribution"]))
    .map((b): Bin | null => {
      const x = obj(b);
      const c = x && count(first(x, ["count", "n", "value"]));
      if (!x || c === null) return null;
      const from = num(x, ["from", "min", "deg"]);
      const to = num(x, ["to", "max"]);
      const label =
        text(x.label) ??
        (from !== null ? (to !== null ? `${from}–${to}°` : `${from}°+`) : null);
      return label ? { label, from, to, count: c } : null;
    })
    .filter((x): x is Bin => !!x);
  const worst = arr(first(o, ["worstCallouts", "worst", "callouts"]))
    .map((w) => {
      const x = obj(w);
      const place = x && text(first(x, ["place", "callout", "name"]));
      return x && place
        ? {
            place,
            offset: num(x, ["offset", "offsetDeg", "medianOffset"]),
            duels: count(first(x, ["duels", "count"])),
          }
        : null;
    })
    .filter((x): x is DeepCrosshair["worst"][number] => !!x);
  const median = num(o, ["medianOffset", "medianOffsetDeg", "preAimOffset"]);
  const well = pct(
    first(o, ["wellPreAimed", "wellPreAimedPct", "preAimedPct"]),
  );
  if (median === null && well === null && !histogram.length && !worst.length)
    return undefined;
  return {
    ...opt("summary", text(o.summary)),
    medianOffset: median === null ? null : Math.abs(median),
    wellPreAimed: well,
    duels: count(first(o, ["duels", "samples"])),
    pitch,
    pitchBias: bias,
    histogram,
    worst,
  };
}

function parsePositioning(raw: unknown): DeepPositioning | undefined {
  const o = obj(raw);
  if (!o) return undefined;
  // Reviews saved before zones carried their numbers: take them from byCallout.
  const byCallout = new Map(
    arr(o.byCallout)
      .map(obj)
      .filter((c): c is Record<string, unknown> => !!c && !!text(c.place))
      .map((c) => [text(c.place)!, c]),
  );
  const zones = arr(first(o, ["dangerZones", "zones"]))
    .map((z): DangerZone | null => {
      const x = obj(z);
      const place = x && text(first(x, ["place", "callout", "name"]));
      if (!x || !place) return null;
      const c = byCallout.get(place) ?? {};
      return {
        place,
        deaths: count(x.deaths),
        rounds: arr(x.rounds)
          .map(finite)
          .filter((r): r is number => r !== null),
        traded: count(x.traded ?? c.traded),
        avgIsolation: num({ v: x.avgIsolation ?? c.avgIsolation }, ["v"]),
        crossfire: count(x.crossfire),
        ...opt("clip", parseClip(x.clip ?? arr(x.clips)[0])),
      };
    })
    .filter((x): x is DangerZone => !!x);
  const isolation = pct(
    first(o, ["isolation", "isolatedDeaths", "isolationPct"]),
  );
  const crossfire = pct(first(o, ["crossfire", "crossfirePct"]));
  if (!zones.length && isolation === null && crossfire === null)
    return undefined;
  return {
    ...opt("summary", text(o.summary)),
    isolation,
    crossfire,
    traded: pct(first(o, ["traded", "tradedDeaths", "tradedPct"])),
    zones,
  };
}

function parseRound(raw: unknown): RoundRow | null {
  const o = obj(raw);
  const round = o && finite(first(o, ["round", "n"]));
  if (!o || round === null || round < 1) return null;
  const side = o.side === "CT" || o.side === "T" ? o.side : null;
  const won =
    typeof o.won === "boolean"
      ? o.won
      : o.outcome === "win" || o.outcome === "won"
        ? true
        : o.outcome === "loss" || o.outcome === "lost"
          ? false
          : null;
  return {
    round: Math.round(round),
    side,
    won,
    ...opt("buy", text(first(o, ["buy", "economy"]))),
    kills: count(o.kills),
    damage: count(first(o, ["damage", "adr"])),
    died: typeof o.died === "boolean" ? o.died : null,
    tags: strs(o.tags).slice(0, 6),
    ...opt("note", text(first(o, ["note", "summary", "comment"]))),
    ...opt("clip", parseClip(o.clip)),
  };
}

export function normalizeDeep(raw: unknown): DeepReview | undefined {
  const o = obj(raw);
  if (!o) return undefined;
  const deep: DeepReview = {
    ...opt("utility", parseUtility(o.utility)),
    ...opt(
      "crosshair",
      parseCrosshair(first(o, ["crosshair", "crosshairPlacement"])),
    ),
    ...opt("positioning", parsePositioning(o.positioning)),
    rounds: arr(first(o, ["rounds", "roundTable"]))
      .map(parseRound)
      .filter((r): r is RoundRow => !!r)
      .sort((a, b) => a.round - b.round),
    history: parseHistory(first(o, ["history", "historyCompare"])),
  };
  const any =
    deep.utility || deep.crosshair || deep.positioning || deep.rounds.length;
  return any || deep.history.length ? deep : undefined;
}
