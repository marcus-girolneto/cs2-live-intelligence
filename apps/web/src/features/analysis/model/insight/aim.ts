import { finite, weaponClass, weaponName } from "@/shared/format";
import {
  BODY_REGIONS,
  type BodyRegion,
  type Detail,
  type PlayerEvents,
  type WeaponRow,
} from "./types";

const REGION: Record<string, BodyRegion | undefined> = {
  head: "head",
  neck: "head",
  chest: "chest",
  stomach: "stomach",
  left_arm: "arms",
  right_arm: "arms",
  left_leg: "legs",
  right_leg: "legs",
};

/** Shots fired and gun hits (detail first, then shot/damage events). */
export function shotsAndHits(
  d: Detail,
  { damage, shots: shotsEv }: PlayerEvents,
) {
  const evShots = shotsEv.length > 0 ? shotsEv.length : null;
  const gunHits = damage.filter((e) => {
    const c = weaponClass(e.weapon);
    return (
      e.weapon !== undefined &&
      c !== "grenade" &&
      c !== "knife" &&
      c !== "other"
    );
  }).length;
  const shots = finite(d?.shots) ?? evShots;
  const hits =
    finite(d?.hits) ?? (evShots !== null ? Math.min(gunHits, evShots) : null);
  return { shots, hits };
}

function fold(entries: [string, number][]) {
  const out: Record<BodyRegion, number> = {
    head: 0,
    chest: 0,
    stomach: 0,
    arms: 0,
    legs: 0,
  };
  let any = false;
  for (const [k, n] of entries) {
    const r = REGION[k];
    const v = finite(n);
    if (r && v !== null && v > 0) {
      out[r] += v;
      any = true;
    }
  }
  return any ? out : null;
}

/** Hits per body region (detail first, then damage events). */
export function hitgroupsOf(d: Detail, { damage }: PlayerEvents) {
  let hitgroups: Record<BodyRegion, number> | null = null;
  if (d?.hitgroups) hitgroups = fold(Object.entries(d.hitgroups));
  if (!hitgroups) {
    const counts = new Map<string, number>();
    for (const e of damage)
      if (e.hitgroup) counts.set(e.hitgroup, (counts.get(e.hitgroup) ?? 0) + 1);
    hitgroups = fold([...counts]);
  }
  const groups = hitgroups;
  const hitTotal = groups ? BODY_REGIONS.reduce((n, r) => n + groups[r], 0) : 0;
  return { hitgroups, hitTotal };
}

function row(
  weapon: string,
  k: number,
  hs: number,
  dmg: number,
  s: number | null,
  h: number | null,
): WeaponRow {
  return {
    weapon,
    name: weaponName(weapon) ?? weapon,
    cls: weaponClass(weapon),
    kills: k,
    headshots: hs,
    damage: dmg,
    shots: s,
    hits: h,
    accuracy: s && s > 0 && h !== null ? Math.min(100, (h / s) * 100) : null,
    hsRate: k > 0 ? (hs / k) * 100 : null,
  };
}

/** Per-weapon kills, damage and accuracy, most kills first. */
export function weaponsOf(
  d: Detail,
  { kills, damage, shots: shotsEv }: PlayerEvents,
): WeaponRow[] {
  let weapons: WeaponRow[] = [];
  if (d?.weapons?.length)
    weapons = d.weapons.map((w) =>
      row(
        w.weapon,
        w.kills,
        w.headshots,
        w.damage,
        w.shots > 0 ? w.shots : null,
        w.shots > 0 ? w.hits : null,
      ),
    );
  else if (kills.some((k) => k.weapon) || damage.some((x) => x.weapon)) {
    const agg = new Map<
      string,
      { k: number; hs: number; dmg: number; s: number; h: number }
    >();
    const get = (w: string) => {
      const key = weaponName(w) ?? w;
      let entry = agg.get(key);
      if (!entry) {
        entry = { k: 0, hs: 0, dmg: 0, s: 0, h: 0 };
        agg.set(key, entry);
      }
      return entry;
    };
    for (const k of kills)
      if (k.weapon) {
        const a = get(k.weapon);
        a.k++;
        if (k.headshot) a.hs++;
      }
    for (const x of damage)
      if (x.weapon) {
        const a = get(x.weapon);
        a.dmg += x.healthDamage;
        a.h++;
      }
    for (const s of shotsEv) get(s.weapon).s++;
    weapons = [...agg].map(([w, a]) =>
      row(
        w,
        a.k,
        a.hs,
        a.dmg,
        a.s > 0 ? a.s : null,
        a.s > 0 ? Math.min(a.h, a.s) : null,
      ),
    );
  }
  return weapons
    .filter((w) => w.kills > 0 || w.damage > 0 || (w.shots ?? 0) > 0)
    .sort((a, b) => b.kills - a.kills || b.damage - a.damage);
}
