import { NotFoundError, ValidationError } from "../../shared/errors/index.js";
import type { Logger } from "../../shared/logging/logger.js";
import type { AnalysisHistory } from "./coaching.ports.js";
import {
  classifyOwnership,
  type Ownership,
  type OwnershipRecord,
} from "./ownership.policy.js";
import type { OwnershipRepository } from "./ownership.repository.js";

type Player = { steamId: string; name?: string };
/** GET /v1/matches/ownership item. */
export type OwnershipItemDto = {
  jobId: string;
  ownership: Ownership;
  playerSteamId?: string;
  /** Display only (untrusted demo text). */
  playerName?: string;
  matchedBy: OwnershipRecord["matchedBy"];
};

const playersOf = (analysis: unknown): Player[] => {
  const list = (analysis as { players?: unknown } | null)?.players;
  return Array.isArray(list)
    ? list
        .filter(
          (p): p is Player =>
            typeof p === "object" &&
            p !== null &&
            typeof (p as Player).steamId === "string",
        )
        .map((p) => ({
          steamId: p.steamId,
          ...(typeof p.name === "string" ? { name: p.name.slice(0, 128) } : {}),
        }))
    : [];
};

/**
 * Classifies every processed demo as the account's own match ("mine") or someone else's
 * ("external") and keeps the account's in-demo identity per match. Personal features
 * (progress, learned profile, personal coach, reports, auto-review) only use "mine" matches.
 */
export class OwnershipService {
  constructor(
    private readonly repository: OwnershipRepository,
    /** Unfiltered analyses of an owner (never the mine-only view). */
    private readonly history: AnalysisHistory,
    private readonly logger: Logger,
  ) {}

  /** (Re)classifies one completed job; undefined when it is not a completed analysis. */
  async classify(
    ownerId: string,
    jobId: string,
  ): Promise<(OwnershipRecord & { players: Player[] }) | undefined> {
    const stored = await this.history.analysis(ownerId, jobId);
    if (!stored) return undefined;
    const players = playersOf(stored.analysis);
    const [account, [previous]] = await Promise.all([
      this.repository.account(ownerId),
      this.repository.records(ownerId, [jobId]),
    ]);
    const next = classifyOwnership(players, account, previous);
    const record: OwnershipRecord = { jobId, ownerId, ...next };
    if (
      !previous ||
      previous.ownership !== next.ownership ||
      previous.playerSteamId !== next.playerSteamId ||
      previous.matchedBy !== next.matchedBy
    )
      await this.repository.save(record);
    return { ...record, players };
  }

  /** Classifies completed jobs that have no ownership yet (startup backfill and polling). */
  async backfill(limit = 200): Promise<number> {
    let done = 0;
    for (const job of await this.repository.unclassified(limit))
      try {
        if (await this.classify(job.ownerId, job.jobId)) done++;
      } catch (error) {
        this.logger.info(
          { jobId: job.jobId, err: String(error) },
          "ownership classification failed",
        );
      }
    return done;
  }

  /**
   * Every completed analysis of the owner with its ownership (unclassified ones are
   * classified now, so reads never depend on the background backfill having run).
   */
  async ensure(ownerId: string): Promise<OwnershipRecord[]> {
    const [records, analyses] = await Promise.all([
      this.repository.records(ownerId),
      this.history.completedAnalyses(ownerId, 500),
    ]);
    const known = new Set(records.map((r) => r.jobId));
    const missing = analyses.filter((a) => !known.has(a.id));
    if (!missing.length) return records;
    const account = await this.repository.account(ownerId);
    for (const a of missing) {
      const record: OwnershipRecord = {
        jobId: a.id,
        ownerId,
        ...classifyOwnership(playersOf(a.analysis), account, null),
      };
      await this.repository.save(record);
      records.push(record);
    }
    return records;
  }

  /** Job id → the account's player in that match, for "mine" matches only. */
  async mine(ownerId: string): Promise<Map<string, string>> {
    return new Map(
      (await this.ensure(ownerId))
        .filter((r) => r.ownership === "mine" && r.playerSteamId)
        .map((r) => [r.jobId, r.playerSteamId!]),
    );
  }

  async records(ownerId: string): Promise<OwnershipRecord[]> {
    return this.ensure(ownerId);
  }

  /** GET /v1/matches/ownership?ids= (unknown or unfinished ids are left out). */
  async list(
    ownerId: string,
    ids: string[],
  ): Promise<{ items: OwnershipItemDto[] }> {
    const known = new Map(
      (await this.repository.records(ownerId, ids)).map((r) => [r.jobId, r]),
    );
    const items: OwnershipItemDto[] = [];
    for (const id of ids) {
      const stored = await this.history.analysis(ownerId, id);
      if (!stored) continue;
      const record = known.get(id) ?? (await this.classify(ownerId, id));
      if (!record) continue;
      const name = playersOf(stored.analysis).find(
        (p) => p.steamId === record.playerSteamId,
      )?.name;
      items.push({
        jobId: id,
        ownership: record.ownership,
        ...(record.playerSteamId
          ? { playerSteamId: record.playerSteamId }
          : {}),
        ...(name ? { playerName: name } : {}),
        matchedBy: record.matchedBy,
      });
    }
    return { items };
  }

  /** PATCH /v1/matches/:id/ownership: "I'm this player" or "Not my match". */
  async override(
    ownerId: string,
    jobId: string,
    ownership: Ownership,
    playerSteamId: string | undefined,
  ): Promise<OwnershipItemDto> {
    const stored = await this.history.analysis(ownerId, jobId);
    if (!stored) throw new NotFoundError("Analysis not found");
    const players = playersOf(stored.analysis);
    let player: string | null = null;
    if (ownership === "mine") {
      const account = await this.repository.account(ownerId);
      player =
        playerSteamId ??
        (players.some((p) => p.steamId === account.steamId)
          ? account.steamId
          : null);
      if (!player || !players.some((p) => p.steamId === player))
        throw new ValidationError("Choose which player you are in this demo.", {
          code: "player_required",
        });
    }
    await this.repository.save({
      jobId,
      ownerId,
      ownership,
      playerSteamId: player,
      matchedBy: "user",
    });
    const name = players.find((p) => p.steamId === player)?.name;
    return {
      jobId,
      ownership,
      ...(player ? { playerSteamId: player } : {}),
      ...(name ? { playerName: name } : {}),
      matchedBy: "user",
    };
  }

  /**
   * PUT /v1/coach/identity: "I am this player" in the given demos (or every demo containing
   * them). Demos where the account's own Steam ID plays keep the Steam match.
   */
  async setIdentity(
    ownerId: string,
    steamId: string,
    analysisIds: string[] | "all",
  ): Promise<{ steamId: string; updated: number; matches: number }> {
    const account = await this.repository.account(ownerId);
    const analyses = await this.history.completedAnalyses(ownerId, 500);
    const wanted =
      analysisIds === "all" ? undefined : new Set<string>(analysisIds);
    const targets = analyses.filter(
      (a) =>
        (!wanted || wanted.has(a.id)) &&
        playersOf(a.analysis).some((p) => p.steamId === steamId),
    );
    if (!targets.length)
      throw new NotFoundError("That player is not in your demos.", {
        code: "player_not_found",
      });
    let updated = 0;
    for (const a of targets) {
      if (playersOf(a.analysis).some((p) => p.steamId === account.steamId))
        continue;
      await this.repository.save({
        jobId: a.id,
        ownerId,
        ownership: "mine",
        playerSteamId: steamId,
        matchedBy: "chosen",
      });
      updated++;
    }
    if (!account.steamId)
      await this.repository.setChosenPlayer(ownerId, steamId);
    return { steamId, updated, matches: targets.length };
  }
}
