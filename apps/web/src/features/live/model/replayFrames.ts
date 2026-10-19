import type { LiveState } from "@cs2/contracts";
import type { AuditedAnalysis } from "@/features/analysis";

export type FeedItem = {
  id: string;
  round: number;
  attacker?: string;
  victim: string;
  attackerSide?: "CT" | "T";
  victimSide?: "CT" | "T";
  headshot: boolean;
};
export type ReplayFrame = { state: LiveState; feed: FeedItem[] };

const side = (team: unknown) =>
  team === "CT" || team === "T" ? (team as "CT" | "T") : undefined;

/**
 * Builds a second-screen replay of one player's match from demo events. Frames use the same
 * shape as live GSI state so the HUD renders them identically, but are labeled as replay.
 */
export function buildReplay(
  analysis: AuditedAnalysis,
  steamId: string,
  sessionId = "replay",
): ReplayFrame[] {
  const events = [...(analysis.events ?? [])].sort((a, b) => a.tick - b.tick);
  const outcomes = new Map(
    (analysis.roundOutcomes ?? []).map((r) => [r.round, r.winner]),
  );
  const rounds = [...new Set(events.map((e) => e.round))].sort((a, b) => a - b);
  const frames: ReplayFrame[] = [];
  const score = { ct: 0, t: 0 };
  let kills = 0;
  let deaths = 0;
  let sequence = 0;
  let feed: FeedItem[] = [];
  const frame = (round: number, phase: string, health: number) => {
    sequence++;
    const at = new Date(Date.UTC(2026, 0, 1, 0, 0, sequence)).toISOString();
    frames.push({
      state: {
        schemaVersion: "1.0",
        sessionId,
        source: "gsi",
        visibility: "own-player",
        sequence,
        observedAt: at,
        receivedAt: at,
        ...(analysis.map ? { map: analysis.map } : {}),
        phase,
        round,
        score: { ...score },
        ownStats: { kills, deaths, health },
      },
      feed,
    });
  };
  for (const round of rounds) {
    let health = 100;
    frame(round, "freezetime", health);
    for (const e of events.filter((x) => x.round === round)) {
      if (e.type === "round_end") continue;
      if (e.type === "damage" && e.victimId === steamId) {
        health = Math.max(0, health - e.healthDamage);
        frame(round, "live", health);
      }
      if (e.type === "kill") {
        feed = [
          ...feed,
          {
            id: e.id,
            round,
            ...(e.attackerId ? { attacker: e.attackerId } : {}),
            victim: e.victimId,
            ...(side(e.attackerTeam)
              ? { attackerSide: side(e.attackerTeam) }
              : {}),
            ...(side(e.victimTeam) ? { victimSide: side(e.victimTeam) } : {}),
            headshot: e.headshot,
          },
        ].slice(-6);
        if (
          e.attackerId === steamId &&
          e.victimId !== steamId &&
          e.attackerTeam !== e.victimTeam
        )
          kills++;
        if (e.victimId === steamId) {
          deaths++;
          health = 0;
        }
        if (e.attackerId === steamId || e.victimId === steamId)
          frame(round, "live", health);
      }
    }
    const winner = outcomes.get(round);
    if (winner === "CT") score.ct++;
    if (winner === "T") score.t++;
    frame(round, "over", health);
  }
  const lastHealth = frames.at(-1)?.state.ownStats?.health ?? 100;
  if (rounds.length) frame(rounds.at(-1)!, "gameover", lastHealth);
  return frames;
}
