import { calloutName } from "@cs2/contracts/callouts";
/** Weapon classes used for icons and grouping. */
export type WeaponClass =
  | "rifle"
  | "sniper"
  | "smg"
  | "heavy"
  | "pistol"
  | "knife"
  | "grenade"
  | "other";

const WEAPONS: Record<string, [string, WeaponClass]> = {
  ak47: ["AK-47", "rifle"],
  m4a1: ["M4A4", "rifle"],
  m4a4: ["M4A4", "rifle"],
  m4a1_silencer: ["M4A1-S", "rifle"],
  m4a1s: ["M4A1-S", "rifle"],
  famas: ["FAMAS", "rifle"],
  galilar: ["Galil AR", "rifle"],
  galil: ["Galil AR", "rifle"],
  aug: ["AUG", "rifle"],
  sg556: ["SG 553", "rifle"],
  sg553: ["SG 553", "rifle"],
  awp: ["AWP", "sniper"],
  ssg08: ["SSG 08", "sniper"],
  scout: ["SSG 08", "sniper"],
  g3sg1: ["G3SG1", "sniper"],
  scar20: ["SCAR-20", "sniper"],
  mac10: ["MAC-10", "smg"],
  mp9: ["MP9", "smg"],
  mp7: ["MP7", "smg"],
  mp5sd: ["MP5-SD", "smg"],
  mp5: ["MP5-SD", "smg"],
  ump45: ["UMP-45", "smg"],
  p90: ["P90", "smg"],
  bizon: ["PP-Bizon", "smg"],
  nova: ["Nova", "heavy"],
  xm1014: ["XM1014", "heavy"],
  mag7: ["MAG-7", "heavy"],
  sawedoff: ["Sawed-Off", "heavy"],
  m249: ["M249", "heavy"],
  negev: ["Negev", "heavy"],
  glock: ["Glock-18", "pistol"],
  glock18: ["Glock-18", "pistol"],
  hkp2000: ["P2000", "pistol"],
  p2000: ["P2000", "pistol"],
  usp_silencer: ["USP-S", "pistol"],
  usps: ["USP-S", "pistol"],
  usp: ["USP-S", "pistol"],
  p250: ["P250", "pistol"],
  elite: ["Dual Berettas", "pistol"],
  dualberettas: ["Dual Berettas", "pistol"],
  fiveseven: ["Five-SeveN", "pistol"],
  tec9: ["Tec-9", "pistol"],
  cz75a: ["CZ75-Auto", "pistol"],
  cz75: ["CZ75-Auto", "pistol"],
  deagle: ["Desert Eagle", "pistol"],
  deserteagle: ["Desert Eagle", "pistol"],
  revolver: ["R8 Revolver", "pistol"],
  r8revolver: ["R8 Revolver", "pistol"],
  taser: ["Zeus x27", "other"],
  zeus: ["Zeus x27", "other"],
  zeusx27: ["Zeus x27", "other"],
  knife: ["Knife", "knife"],
  bayonet: ["Knife", "knife"],
  hegrenade: ["HE Grenade", "grenade"],
  he: ["HE Grenade", "grenade"],
  hegrenadeprojectile: ["HE Grenade", "grenade"],
  inferno: ["Molotov", "grenade"],
  molotov: ["Molotov", "grenade"],
  incgrenade: ["Incendiary", "grenade"],
  incendiarygrenade: ["Incendiary", "grenade"],
  flashbang: ["Flashbang", "grenade"],
  smokegrenade: ["Smoke", "grenade"],
  decoy: ["Decoy", "grenade"],
  decoygrenade: ["Decoy", "grenade"],
  world: ["World", "other"],
  c4: ["C4", "other"],
};

/** Normalizes engine names ("weapon_ak47", "AK-47", "M4A1-S") to a lookup key. */
export function weaponKey(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^weapon_/, "")
    .replace(/[\s\-.]/g, "");
}

function lookup(raw: string): [string, WeaponClass] | undefined {
  const key = weaponKey(raw);
  if (WEAPONS[key]) return WEAPONS[key];
  if (
    key.startsWith("knife") ||
    key.includes("bayonet") ||
    key.includes("karambit")
  )
    return ["Knife", "knife"];
  // Display names sent by some parsers ("M4A1-S", "Desert Eagle").
  const byLabel = Object.values(WEAPONS).find(
    ([label]) => weaponKey(label) === key,
  );
  return byLabel;
}

/** Human weapon name ("ak47" → "AK-47"); unknown names are tidied, never dropped. */
export function weaponName(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const hit = lookup(raw);
  if (hit) return hit[0];
  const cleaned = raw
    .replace(/^weapon_/i, "")
    .replace(/_/g, " ")
    .trim();
  return cleaned.length <= 3
    ? cleaned.toUpperCase()
    : cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function weaponClass(raw: unknown): WeaponClass {
  if (typeof raw !== "string" || !raw.trim()) return "other";
  return lookup(raw)?.[1] ?? "other";
}

/** In-game callout ("TopofMid", "BombsiteA") → readable label ("Top of Mid", "Bombsite A"). */
export function placeName(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  return calloutName(raw);
}
