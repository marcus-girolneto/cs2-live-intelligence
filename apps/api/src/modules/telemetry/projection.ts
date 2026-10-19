import type { LiveState, TelemetryEnvelope } from "@cs2/contracts";

/**
 * GSI envelope → LiveState. Full projections deliberately discard unavailable fields,
 * including fields from previous maps; only the provider's own player stats are kept.
 */
export function project(
  event: TelemetryEnvelope,
  receivedAt: string,
): LiveState {
  const { payload: p } = event;
  const state: LiveState = {
    schemaVersion: "1.0",
    sessionId: event.sessionId,
    source: "gsi",
    visibility: "own-player",
    sequence: event.sequence,
    observedAt: event.observedAt,
    receivedAt,
  };
  if (p.map?.name !== undefined) state.map = p.map.name;
  const phase = p.round?.phase ?? p.map?.phase;
  if (phase !== undefined) state.phase = phase;
  if (p.map?.round !== undefined) state.round = p.map.round;
  const ct = p.map?.team_ct?.score;
  const t = p.map?.team_t?.score;
  if (ct !== undefined || t !== undefined)
    state.score = {
      ...(ct !== undefined ? { ct } : {}),
      ...(t !== undefined ? { t } : {}),
    };
  if (p.provider?.steamid && p.player?.steamid === p.provider.steamid) {
    const stats = { ...p.player.match_stats, ...p.player.state };
    if (Object.keys(stats).length) state.ownStats = stats;
  }
  return state;
}
