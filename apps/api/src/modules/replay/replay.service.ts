import { NotFoundError } from "../../shared/errors/index.js";
import type { ReplayStorage } from "../../infrastructure/storage/replay-storage.js";
import type { ReplayRepository } from "./replay.repository.js";
import {
  MAX_WINDOW_SECONDS,
  type ReplayArtifact,
  type ReplayEventDto,
  type ReplayFrameRow,
  type ReplayMetaDto,
  type ReplayRound,
  type ReplayWindowDto,
} from "./replay.dto.js";

/** Normalized demo event as stored inside the analysis document (read loosely). */
type StoredEvent = {
  id?: unknown;
  tick?: unknown;
  round?: unknown;
  type?: unknown;
  [key: string]: unknown;
};
const NOT_FOUND = { code: "not_found" } as const;
const round2 = (n: number): number => Math.round(n * 100) / 100;
const str = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;
const vec = (v: unknown): [number, number] | undefined => {
  const p = v as { x?: unknown; y?: unknown } | undefined;
  return p && typeof p.x === "number" && typeof p.y === "number"
    ? [p.x, p.y]
    : undefined;
};
/** Copies only defined primitive fields so absent data stays absent (never zero). */
const defined = (fields: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined && v !== ""),
  );

/** Replay endpoints' business rules. Depends only on the injected interfaces. */
export class ReplayService {
  constructor(
    private readonly repository: ReplayRepository,
    private readonly storage: ReplayStorage,
  ) {}

  private async load(
    ownerId: string,
    analysisId: string,
  ): Promise<{ analysis: unknown; replay: ReplayArtifact }> {
    const owned = await this.repository.ownedAnalysis(ownerId, analysisId);
    if (!owned) throw new NotFoundError("Analysis not found", NOT_FOUND);
    const replay = await this.storage.read(analysisId);
    if (!replay) throw new NotFoundError("Replay not available", NOT_FOUND);
    return { analysis: owned.analysis, replay };
  }

  async meta(ownerId: string, analysisId: string): Promise<ReplayMetaDto> {
    const { replay } = await this.load(ownerId, analysisId);
    const firstTeam = new Map<number, string>();
    for (const round of replay.rounds)
      for (const track of round.tracks)
        if (track.team && !firstTeam.has(track.p))
          firstTeam.set(track.p, track.team);
    const outline: [number, number][] = [];
    for (let i = 0; i + 1 < replay.outline.length; i += 2)
      outline.push([replay.outline[i]!, replay.outline[i + 1]!]);
    return {
      map: replay.map ?? null,
      tickRate: replay.tickRate,
      sampleHz: replay.sampleHz,
      rounds: replay.rounds.map((r) => ({
        number: r.number,
        duration: r.duration,
        winner: r.winner ?? null,
        ct: this.side(replay, r, "CT"),
        t: this.side(replay, r, "T"),
      })),
      players: replay.players.map((p, i) => ({
        steamId: p.steamId,
        ...(p.name ? { name: p.name } : {}),
        ...(firstTeam.has(i) ? { team: firstTeam.get(i) } : {}),
      })),
      bounds: replay.bounds ?? null,
      cell: replay.cell,
      outline,
    };
  }

  private side(
    replay: ReplayArtifact,
    round: ReplayRound,
    team: string,
  ): string[] {
    return round.tracks
      .filter((t) => t.team === team)
      .map((t) => replay.players[t.p]?.steamId)
      .filter((id): id is string => !!id);
  }

  async window(
    ownerId: string,
    analysisId: string,
    query: { round: number; from?: number; to?: number },
  ): Promise<ReplayWindowDto> {
    const { analysis, replay } = await this.load(ownerId, analysisId);
    const round = replay.rounds.find((r) => r.number === query.round);
    if (!round)
      throw new NotFoundError("Round not available in the replay", NOT_FOUND);
    const end = round.t.at(-1) ?? round.duration;
    const from = Math.min(query.from ?? 0, end);
    const to = Math.max(
      from,
      Math.min(
        query.to ?? from + MAX_WINDOW_SECONDS,
        from + MAX_WINDOW_SECONDS,
        end,
      ),
    );
    // Response player index = position in this round's track list.
    const players = round.tracks.map((t) => {
      const p = replay.players[t.p];
      return {
        steamId: p?.steamId ?? "",
        ...(p?.name ? { name: p.name } : {}),
        ...(t.team ? { team: t.team } : {}),
      };
    });
    const local = new Map(round.tracks.map((t, i) => [t.p, i]));
    const bySteam = new Map(players.map((p, i) => [p.steamId, i]));
    const frames: ReplayWindowDto["frames"] = [];
    round.t.forEach((t, i) => {
      if (t < from || t > to) return;
      frames.push({
        t,
        p: round.tracks.map((tr, k): ReplayFrameRow => [
          k,
          tr.x[i] ?? 0,
          tr.y[i] ?? 0,
          tr.yaw[i] ?? 0,
          tr.hp[i] ?? 0,
          tr.alive[i] ?? 0,
          tr.w[i] ?? -1,
          tr.fl[i] ?? 0,
          tr.armor[i] ?? 0,
        ]),
      });
    });
    const at = (
      index: number | undefined,
      t: number,
    ): [number, number] | undefined => {
      if (index === undefined || !round.t.length) return undefined;
      const tr = round.tracks[index]!;
      let best = 0;
      for (let i = 1; i < round.t.length; i++)
        if (Math.abs(round.t[i]! - t) < Math.abs(round.t[best]! - t)) best = i;
      return [tr.x[best]!, tr.y[best]!] as [number, number];
    };
    const inWindow = (t: number): boolean => t >= from && t <= to;
    const events: ReplayEventDto[] = [];
    const stored = (analysis as { events?: unknown }).events;
    const timeOf = (tick: number): number =>
      round2((tick - round.freezeTick) / replay.tickRate);
    for (const raw of Array.isArray(stored) ? (stored as StoredEvent[]) : []) {
      if (raw.round !== round.number || typeof raw.tick !== "number") continue;
      const t = timeOf(raw.tick);
      if (!inWindow(t)) continue;
      const attacker = bySteam.get(str(raw.attackerId) ?? "");
      const victim = bySteam.get(str(raw.victimId) ?? "");
      const id = str(raw.id);
      if (raw.type === "kill")
        events.push({
          t,
          type: "kill",
          ...defined({
            id,
            attacker,
            victim,
            assister: bySteam.get(str(raw.assisterId) ?? ""),
            weapon: str(raw.weapon),
            headshot: raw.headshot,
            penetrated: raw.penetrated,
            throughSmoke: raw.throughSmoke,
            noScope: raw.noScope,
            attackerBlind: raw.attackerBlind,
            flashAssist: raw.flashAssist,
            distance: raw.distance,
            attackerPos: vec(raw.attackerPos) ?? at(attacker, t),
            victimPos: vec(raw.victimPos) ?? at(victim, t),
            attackerPlace: str(raw.attackerPlace),
            victimPlace: str(raw.victimPlace),
          }),
        });
      else if (raw.type === "damage")
        events.push({
          t,
          type: "damage",
          ...defined({
            id,
            attacker,
            victim,
            healthDamage: raw.healthDamage,
            armorDamage: raw.armorDamage,
            weapon: str(raw.weapon),
            hitgroup: str(raw.hitgroup),
            attackerPos: at(attacker, t),
            victimPos: at(victim, t),
          }),
        });
      else if (raw.type === "flashed")
        events.push({
          t,
          type: "flashed",
          ...defined({
            id,
            attacker,
            victim,
            durationSeconds: raw.durationSeconds,
          }),
        });
      else if (raw.type === "bomb") {
        const action = str(raw.action);
        const match = (round.bomb ?? []).find(
          (b) => b.action === action && Math.abs(b.t - t) < 1,
        );
        events.push({
          t,
          type: "bomb",
          ...defined({
            id,
            action,
            player: bySteam.get(str(raw.playerId) ?? ""),
            site: str(raw.site),
            pos: match?.pos,
          }),
        });
      }
    }
    for (const [t, p, x, y, yaw, w] of round.shots)
      if (inWindow(t))
        events.push({
          t,
          type: "shot",
          ...defined({
            shooter: local.get(p),
            x,
            y,
            yaw,
            weapon: replay.weapons[w],
          }),
        });
    for (const g of round.grenades)
      if (g.t1 >= from && g.t0 <= to)
        events.push({
          t: g.t0,
          type: "grenade",
          ...defined({
            grenade: g.type,
            thrower: local.get(g.p),
            from: g.from,
            to: g.to,
            detonateT: g.t1,
            path: g.path,
          }),
        });
    events.sort((a, b) => a.t - b.t);
    return {
      round: round.number,
      sampleHz: replay.sampleHz,
      from: round2(from),
      to: round2(to),
      duration: round.duration,
      winner: round.winner ?? null,
      players,
      weapons: replay.weapons,
      frames,
      events,
    };
  }
}
