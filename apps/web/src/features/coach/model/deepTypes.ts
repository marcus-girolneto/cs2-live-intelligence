/** Types of the Deep review view model (see deep.ts). */
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
  title: string;
  type: NadeType | null;
  place?: string;
  why?: string;
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
export type Bin = { label: string; from: number | null; count: number };
export type DeepCrosshair = {
  summary?: string;
  medianOffset: number | null;
  wellPreAimed: number | null;
  duels: number | null;
  pitch: "low" | "high" | "level" | null;
  pitchBias: number | null;
  histogram: Bin[];
  worst: { place: string; offset: number | null; duels: number | null }[];
};
export type DangerZone = {
  place: string;
  deaths: number | null;
  rounds: number[];
  why?: string;
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
