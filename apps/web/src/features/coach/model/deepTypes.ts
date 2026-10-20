/** Types of the Deep review view model (see deep.ts). */
import type {
  CrosshairCategory,
  HeightBand,
  HorizontalBias,
} from "@cs2/contracts/crosshair";
import type { ClipRef } from "@/features/replay";

export type NadeType = "flash" | "smoke" | "he" | "molotov" | "decoy";
export type Point = { x: number; y: number };
export type NadeThrow = {
  round: number | null;
  type: NadeType;
  time: number | null;
  place?: string;
  landing?: Point;
  from?: Point;
  result?: string;
  damage: number | null;
  enemiesFlashed: number | null;
  /** good / wasted / harmful (team flash) */
  verdict: "good" | "wasted" | "harmful" | null;
  clip?: ClipRef;
};
export type NadeStat = {
  type: NadeType;
  thrown: number;
  effective: number | null;
  damage: number | null;
  enemiesFlashed: number | null;
  blindSeconds: number | null;
  efficiency: number | null;
};
export type Lineup = {
  /** repeat = one of your best throws; learn = what the lobby threw where you die. */
  kind: "repeat" | "learn" | null;
  type: NadeType | null;
  place?: string;
  fromPlace?: string;
  round: number | null;
  count: number | null;
  enemiesFlashed: number | null;
  blindSeconds: number | null;
  damage: number | null;
  deathsThere: number | null;
  /** Written by the model (already in the review's language). */
  howTo?: string;
  clip?: ClipRef;
};
export type DeepUtility = {
  summary?: string;
  efficiency: number | null;
  throws: NadeThrow[];
  perType: NadeStat[];
  lineups: Lineup[];
};
/** Crosshair placement in player terms (degrees stay on the server). */
export type DeepCrosshair = {
  summary?: string;
  preAim: { onTarget: number; close: number; off: number; total: number };
  heightBand: HeightBand | null;
  horizontalBias: HorizontalBias | null;
  perCallout: { callout: string; onTarget: number; total: number }[];
  dots: { x: number; y: number; won?: boolean; category: CrosshairCategory }[];
};
export type DangerZone = {
  place: string;
  deaths: number | null;
  rounds: number[];
  traded: number | null;
  /** Mean distance to the nearest living teammate, in world units. */
  avgIsolation: number | null;
  /** Deaths where 2+ enemies had damaged you in the last 5 s. */
  crossfire: number | null;
  clip?: ClipRef;
};
export type DeepPositioning = {
  summary?: string;
  isolation: number | null;
  crossfire: number | null;
  traded: number | null;
  zones: DangerZone[];
};
export type RoundRow = {
  round: number;
  side: "CT" | "T" | null;
  won: boolean | null;
  buy?: string;
  kills: number | null;
  damage: number | null;
  died: boolean | null;
  tags: string[];
  note?: string;
  clip?: ClipRef;
};
export type HistoryChip = {
  key: string;
  label: string;
  current: number;
  baseline: number;
  unit: string;
  better: "lower" | "higher";
};
export type DeepReview = {
  utility?: DeepUtility;
  crosshair?: DeepCrosshair;
  positioning?: DeepPositioning;
  rounds: RoundRow[];
  history: HistoryChip[];
};
