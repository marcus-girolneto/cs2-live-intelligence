import type { MatchDto } from "@/shared/api-types";
import type { Me } from "@/shared/session";
import type { AnalysisResult } from "@/features/analysis";
import { metricValue } from "@/features/analysis";
import { emptyTracker, trackRound, type RoundTracker } from "./liveCoach";
import type { ReplayFrame } from "./replayFrames";

/** The demo to replay: the one the viewer marked "This is me" in, else the newest analysed. */
export function pickReplayMatch(
  matches: MatchDto[],
  me: Me | null,
): MatchDto | undefined {
  const done = matches
    .filter((m) => m.status === "complete" && m.analysisId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return done.find((m) => m.analysisId === me?.analysisId) ?? done[0];
}

/** The viewer when they marked themselves in this demo, else the top-ADR player. */
export function defaultReplayPlayer(
  result: AnalysisResult,
  me: Me | null,
): string {
  const top = [...result.analysis.players].sort(
    (a, b) => (metricValue(b, "adr") ?? -1) - (metricValue(a, "adr") ?? -1),
  )[0];
  return me?.analysisId === result.id ? me.steamId : (top?.steamId ?? "");
}

/** Round tracker after playing frames 0..index. */
export function trackerAt(frames: ReplayFrame[], index: number): RoundTracker {
  let tr = emptyTracker();
  for (const f of frames.slice(0, index + 1)) tr = trackRound(tr, f.state);
  return tr;
}
