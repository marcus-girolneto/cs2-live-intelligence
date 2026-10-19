/** Replay view models (normalised from the replay DTOs by ./normalize). */
export type Team = "CT" | "T";
export type ReplayPlayer = { steamId: string; name: string; team: Team | null };
export type Bounds = { minX: number; maxX: number; minY: number; maxY: number };
export type ReplayRound = {
  number: number;
  duration: number | null;
  winner: Team | null;
  ct: string[];
  t: string[];
};
export type ReplayMeta = {
  map: string | null;
  /** Outline cell size in world units (API `cell`), else inferred. */
  cell: number | null;
  tickRate: number | null;
  sampleHz: number;
  rounds: ReplayRound[];
  players: ReplayPlayer[];
  bounds: Bounds;
  outline: [number, number][];
};
/** One player at one instant (frames index players of the window, not of the meta). */
export type Sample = {
  i: number;
  x: number;
  y: number;
  yaw: number;
  hp: number;
  alive: boolean;
  weapon: number | null;
  flashed: number;
};
export type Frame = { t: number; p: Sample[] };
export type Point = { x: number; y: number };
export type GrenadeKind = "smoke" | "molotov" | "he" | "flash" | "decoy";
export type ReplayEvent = {
  /** Normalised demo event id (coaching eventIds point here). */
  id?: string;
  t: number;
  /** Shooter view angle for shot tracers. */
  yaw?: number;
  type: "kill" | "shot" | "damage" | "grenade" | "flashed" | "bomb";
  attacker?: number;
  victim?: number;
  weapon?: string;
  headshot?: boolean;
  /** Event position (victim for kills/damage, landing spot for grenades, plant site for bomb). */
  pos?: Point;
  /** Secondary position (attacker for kills, thrower for grenades). */
  from?: Point;
  grenade?: GrenadeKind;
  damage?: number;
  action?: string;
  place?: string;
  duration?: number;
};
export type ReplayWindow = {
  round: number;
  sampleHz: number;
  from: number;
  to: number;
  players: ReplayPlayer[];
  frames: Frame[];
  weapons: string[];
  events: ReplayEvent[];
};
