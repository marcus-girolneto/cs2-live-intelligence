/** Response of GET /v1/coach/progress (fields rendered defensively). */
export type LearnedMetric = {
  overall: number | null;
  recent: number | null;
  matches: number;
};
export type TimelineEntry = Record<string, number | string | null> & {
  analysisId: string;
  date: string;
  /** Final score of the coached player's team (null/absent when unknown). */
  roundsWon?: number | null;
  roundsLost?: number | null;
};
export type Review = {
  id: string;
  analysisId: string;
  filename: string;
  /** Player the review is about (absent on very old rows). */
  steamId?: string;
  createdAt: string;
  rating: number | null;
  /** Full stored coaching (normalised by the coach feature before rendering). */
  coaching: Record<string, unknown> & { summary?: string; plan?: string[] };
};
export type LiveCallRecord = {
  id: string;
  round: number | null;
  call: { call?: string; why?: string; focus?: string };
  createdAt: string;
};
export type Progress = {
  playerSteamId: string | null;
  linkedToSteam: boolean;
  analyzedMatches: number;
  profile: {
    matches: number;
    rounds: number;
    metrics: Record<string, LearnedMetric>;
    tendencies: string[];
    recurring: { pattern: string; matches: number }[];
  } | null;
  timeline: TimelineEntry[];
  reviews: Review[];
  liveCalls: LiveCallRecord[];
  /** Per-map learning (optional; derived from the timeline when absent). */
  maps?: unknown;
  /** Plan items that apply to every map (optional). */
  generalPlan?: unknown;
};
export const PROGRESS_METRICS: {
  key: string;
  label: string;
  unit?: "%";
  digits: number;
}[] = [
  { key: "adr", label: "ADR", digits: 1 },
  { key: "kast", label: "KAST", unit: "%", digits: 0 },
  { key: "kd", label: "K/D", digits: 2 },
  { key: "openingSuccess", label: "Opening duels won", unit: "%", digits: 0 },
  { key: "tradedDeaths", label: "Deaths traded", unit: "%", digits: 0 },
  { key: "headshotPercentage", label: "Headshot %", unit: "%", digits: 0 },
];
