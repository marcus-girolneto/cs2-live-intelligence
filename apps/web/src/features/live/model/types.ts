import type { LiveState } from "@cs2/contracts";
import type { Baseline, RoundRecord } from "./liveCoach";

/** Local match simulator status (GET/POST /api/simulator). */
export type Simulator = {
  available: boolean;
  running?: boolean;
  round?: number;
  rounds?: number;
};
export type SimulatorAction = "start" | "stop";
/** A session to subscribe to; `key` forces a reconnect to the same id. */
export type LiveTarget = { id: string; key: number };
/** POST /api/ticket outcome: a ticket, or the HTTP status and server message. */
export type TicketResult =
  { ok: true; ticket: string } | { ok: false; status: number; error?: string };

/** AI IGL call between rounds (POST ai/live-call). */
export type LiveCall = {
  call: string;
  why: string;
  focus: string;
  confidence: string;
};
export type LiveCallResult = { id: string; call: LiveCall };
export type LiveCallRequest = {
  state: LiveState | null;
  rounds: RoundRecord[];
  baseline: Baseline | null;
  lang: string;
  /** Live sessions: the server reads its own authoritative state. */
  sessionId?: string;
  /** Replays: the analysed match, so all calls of one replay count as one match. */
  analysisId?: string;
};
