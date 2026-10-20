/**
 * CS2 console snippets for a private practice server. Every command was checked against the
 * CS2 command/convar dump (SteamDatabase/GameTracking-CS2, DumpSource2/commands.txt and
 * convars.txt); see docs/COACHING_METHOD.md. Coordinates are world units from the demo.
 *
 * Angle convention (the game's): pitch positive = looking down, yaw 0 = +X, 90 = +Y.
 */

/** Practice config, one command per line (all exist in CS2; cheats needed for some). */
export const PRACTICE_CONFIG: readonly string[] = [
  "sv_cheats 1",
  "bot_kick",
  "mp_warmup_end",
  "mp_freezetime 0",
  "mp_roundtime_defuse 60",
  "mp_buy_anywhere 1",
  "mp_buytime 9999",
  "mp_maxmoney 60000",
  "mp_startmoney 60000",
  "sv_infinite_ammo 1",
  "ammo_grenade_limit_total 5",
  "sv_grenade_trajectory_prac_pipreview 1",
  "sv_showimpacts 1",
  "mp_restartgame 1",
];

/** Bots for "where the enemy was": add one, keep it still and harmless, then bot_place. */
export const botSetup = (enemySide: "T" | "CT"): string[] => [
  enemySide === "T" ? "bot_add_t" : "bot_add_ct",
  "bot_stop 1",
  "bot_dont_shoot 1",
];

/** Standing eye height above the origin (feet), as in the game. */
export const EYE_HEIGHT = 64;
/**
 * Demo heights are whole units (the parser rounds); a small lift keeps the player above the
 * floor so `setpos_exact` never places the origin inside it (you drop a couple of units).
 */
export const SETPOS_LIFT = 2;

export type Vec3 = { x: number; y: number; z: number };
export type Angles = { pitch: number; yaw: number };

const RAD = Math.PI / 180;
const fixed = (n: number, digits: number) => {
  const s = n.toFixed(digits);
  return /^-0(\.0+)?$/.test(s) ? s.slice(1) : s;
};
/** Yaw wrapped to -180..180 (what getpos prints). */
export const normalizeYaw = (yaw: number): number => {
  const w = ((((yaw + 180) % 360) + 360) % 360) - 180;
  return w === -180 ? 180 : w;
};
export const clampPitch = (pitch: number): number =>
  Math.max(-89, Math.min(89, pitch));

/** View angles from one point to another (eye to target). */
export function anglesBetween(from: Vec3, to: Vec3): Angles {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  return {
    yaw: normalizeYaw(Math.atan2(dy, dx) / RAD),
    pitch: clampPitch(-Math.atan2(dz, Math.hypot(dx, dy)) / RAD),
  };
}

/**
 * `setpos_exact x y z`: moves the player's origin (feet) exactly ("Move player to an exact
 * specified origin"). Plain `setpos` is avoided because getpos/setpos pairs work with the eye
 * position in some builds; the exact variant is unambiguous.
 */
export const setposCommand = (feet: Vec3): string =>
  `setpos_exact ${fixed(feet.x, 1)} ${fixed(feet.y, 1)} ${fixed(feet.z + SETPOS_LIFT, 1)}`;
/** `setang pitch yaw 0` ("Snap player eyes to specified pitch yaw <roll>"). */
export const setangCommand = (a: Angles): string =>
  `setang ${fixed(clampPitch(a.pitch), 2)} ${fixed(normalizeYaw(a.yaw), 2)} 0`;

/** One line to paste: teleport, then view angles. */
export const teleportLine = (setpos: string, setang: string): string =>
  `${setpos}; ${setang}`;

/** Everything joined for a single console paste. */
export const consoleBlock = (lines: readonly string[]): string =>
  lines.join("; ");
