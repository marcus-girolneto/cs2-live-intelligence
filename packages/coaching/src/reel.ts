/**
 * Full-match reel (Pro): the coached player's best highlights and clearest mistakes as replay
 * windows in match order, for a continuous video export. Deterministic.
 */
import type { Analysis, Clip } from "@cs2/contracts";
import { clipsFor, momentCandidates, type MomentCandidate } from "./review.js";

export type ReelClip = Clip & {
  kind: "highlight" | "mistake";
  title: string;
  score: number;
};
export type MatchReel = {
  steamId: string;
  map: string | null;
  clips: ReelClip[];
  totalSeconds: number;
};
type Timed = Extract<
  NonNullable<Analysis["events"]>[number],
  { type: "kill" }
> & {
  roundTime: number;
};

/**
 * Scores: highlight = 1 + 2 opening + 1 per extra kill that round + 3 won clutch + 1 trade
 * kill + 0.5 headshot + 1 wallbang/through smoke; mistake = 1 + 2 untraded + 2 opening death
 * + 1 before 20 s.
 */
export function reelScore(
  c: MomentCandidate,
  killsInRound: number,
  clutchWon: boolean,
): number {
  if (c.kind === "kill")
    return (
      1 +
      (c.opening ? 2 : 0) +
      Math.max(0, killsInRound - 1) +
      (clutchWon ? 3 : 0) +
      (c.tradeKill ? 1 : 0) +
      (c.headshot ? 0.5 : 0) +
      (c.wallbang || c.throughSmoke ? 1 : 0)
    );
  return 1 + (c.traded ? 0 : 2) + (c.opening ? 2 : 0) + (c.time < 20 ? 1 : 0);
}

const title = (c: MomentCandidate, kills: number): string => {
  const parts =
    c.kind === "kill"
      ? [
          kills >= 2 ? `${kills} kills` : "Kill",
          ...(c.opening ? ["opening"] : []),
          ...(c.weapon ? [c.weapon] : []),
        ]
      : [
          "Death",
          ...(c.opening ? ["opening"] : []),
          ...(c.traded ? [] : ["untraded"]),
          ...(c.yourPlace ? [`at ${c.yourPlace}`] : []),
        ];
  return `Round ${c.round}: ${parts.join(", ")}`.slice(0, 200);
};

export function matchReel(
  analysis: Analysis,
  steamId: string,
  limits = { highlights: 10, mistakes: 8 },
): MatchReel {
  const player = analysis.players.find((p) => p.steamId === steamId);
  const rounds = new Map((player?.rounds ?? []).map((r) => [r.round, r]));
  const candidates = momentCandidates(analysis, steamId);
  const byId = new Map(
    (analysis.events ?? [])
      .filter(
        (e): e is Timed =>
          e.type === "kill" &&
          typeof (e as { roundTime?: unknown }).roundTime === "number",
      )
      .map((e) => [e.id, e]),
  );
  const scored = candidates.map((c) => {
    const r = rounds.get(c.round);
    return {
      c,
      kills: r?.kills ?? 1,
      score: reelScore(c, r?.kills ?? 1, !!r?.clutchVs && r.won === true),
    };
  });
  const pick = (kind: "kill" | "death", n: number) =>
    scored
      .filter((s) => s.c.kind === kind)
      .sort(
        (a, b) =>
          b.score - a.score || a.c.round - b.c.round || a.c.time - b.c.time,
      )
      .slice(0, n);
  const clips: ReelClip[] = [];
  for (const s of [
    ...pick("kill", limits.highlights),
    ...pick("death", limits.mistakes),
  ]) {
    const event = byId.get(s.c.id);
    if (!event) continue;
    const kind = s.c.kind === "kill" ? "highlight" : "mistake";
    const label = title(s.c, s.kills);
    const [clip] = clipsFor(analysis, [event], steamId, 1, label);
    if (!clip) continue;
    // Windows of the same kind overlapping in a round become one clip.
    const same = clips.find(
      (x) =>
        x.kind === kind &&
        x.round === clip.round &&
        clip.from <= x.to &&
        clip.to >= x.from,
    );
    if (same) {
      same.from = Math.min(same.from, clip.from);
      same.to = Math.max(same.to, clip.to);
      same.eventIds = [...new Set([...same.eventIds, ...clip.eventIds])].slice(
        0,
        20,
      );
      same.score = Math.max(same.score, s.score);
      continue;
    }
    clips.push({ ...clip, kind, title: label, score: s.score });
  }
  clips.sort((a, b) => a.round - b.round || a.from - b.from);
  return {
    steamId,
    map: analysis.map ?? null,
    clips,
    totalSeconds:
      Math.round(clips.reduce((n, c) => n + (c.to - c.from), 0) * 100) / 100,
  };
}
