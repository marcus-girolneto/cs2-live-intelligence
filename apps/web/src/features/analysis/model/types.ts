import type { Analysis, Coaching, DemoEvent } from "@cs2/contracts";

/** Analysis as stored by the API, with the audit fields the screens read. */
export type AuditedAnalysis = Analysis & {
  provenance?: { parserVersion: string; metricVersion: string };
  map?: string;
  roundOutcomes?: { round: number; winner?: "CT" | "T" }[];
  events?: DemoEvent[];
};
/** GET analyses/:id (analysis + offline coaching). */
export type AnalysisResult = {
  id: string;
  analysis: AuditedAnalysis;
  coaching: Coaching;
};
export type Player = Analysis["players"][number];
export type PlayerRound = NonNullable<Player["rounds"]>[number];
export type KillEvent = Extract<DemoEvent, { type: "kill" }>;
export type BombEvent = Extract<DemoEvent, { type: "bomb" }>;
export type Point = { x: number; y: number };

/** One kill-feed line (live HUD and round cards). */
export type KillRow = {
  id: string;
  attacker?: string;
  victim: string;
  attackerSide?: "CT" | "T" | string;
  victimSide?: "CT" | "T" | string;
  headshot: boolean;
  weapon?: string;
  penetrated?: boolean;
  throughSmoke?: boolean;
  noScope?: boolean;
  attackerBlind?: boolean;
  time?: number;
};
