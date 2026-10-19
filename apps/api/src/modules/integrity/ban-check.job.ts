import type { MatchBan } from "@cs2/contracts";
import type { PlayerBansSource } from "../../infrastructure/steam/player-bans.js";
import type { Logger } from "../../shared/logging/logger.js";
import type { IntegrityRepository } from "./integrity.repository.js";

const DAY_MS = 24 * 3600_000;
/** Checks after the analysis completes, then 7 and 30 days after the upload. */
export const BAN_RECHECK_DAYS = [7, 30] as const;
const BATCH = 50;

/**
 * A ban "after the match": the account has a ban and its last ban is more recent than the match.
 * The match date is approximated by the upload date (demos are uploaded after they are played),
 * which errs towards not flagging.
 */
export function bannedAfterMatch(
  bans: { vacBans: number; gameBans: number; daysSinceLastBan: number },
  uploadedAt: Date,
  now: Date,
): boolean {
  if (bans.vacBans + bans.gameBans === 0) return false;
  const daysSinceMatch = Math.floor(
    (now.getTime() - uploadedAt.getTime()) / DAY_MS,
  );
  return bans.daysSinceLastBan < daysSinceMatch;
}

/** The next re-check (7 or 30 days after the upload) still ahead of `now`; null = done. */
export function nextCheck(uploadedAt: Date, now: Date): Date | null {
  for (const days of BAN_RECHECK_DAYS) {
    const at = new Date(uploadedAt.getTime() + days * DAY_MS);
    if (at > now) return at;
  }
  return null;
}

/**
 * Hourly API job (needs the internet, so never in the sandboxed worker): Steam ban state of
 * every participant of each complete match, stored per match (SteamID + ban counts only).
 * Skipped silently when no Steam Web API key is configured.
 */
export class BanCheckJob {
  constructor(
    private readonly repository: IntegrityRepository,
    private readonly source: PlayerBansSource,
    private readonly logger: Logger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async run(): Promise<void> {
    await this.repository.schedule();
    const due = await this.repository.due(BATCH);
    let checked = 0;
    for (const match of due) {
      const found = await this.source.bans(match.steamIds);
      if (!found) return; // no key configured
      const now = this.now();
      const bans: MatchBan[] = match.steamIds.flatMap((steamId) => {
        const b = found.get(steamId);
        return b
          ? [
              {
                ...b,
                bannedAfterMatch: bannedAfterMatch(b, match.uploadedAt, now),
              },
            ]
          : [];
      });
      await this.repository.save(
        match.jobId,
        bans,
        nextCheck(match.uploadedAt, now),
      );
      checked++;
    }
    if (checked) this.logger.info({ checked }, "steam ban checks");
  }
}
