import { parsePreferences } from "@cs2/coaching";
import type { CoachProfileDto, CoachProfileRecord } from "./coaching.dto.js";
import type { CoachingRepository } from "./coaching.repository.js";

const view = (p: CoachProfileRecord): CoachProfileDto => ({
  preferences: parsePreferences(p.preferences),
  playerSteamId: p.playerSteamId,
  linkedToSteam: p.linkedToSteam,
});

/** Coaching preferences and which in-demo player the account is coached as. */
export class CoachProfileService {
  constructor(private readonly coaching: CoachingRepository) {}

  async get(ownerId: string): Promise<CoachProfileDto> {
    return view(await this.coaching.profile(ownerId));
  }

  /**
   * `playerSteamId` undefined keeps the current one; a Steam-linked account is always coached
   * as its own Steam identity, so the stored override is cleared.
   */
  async update(
    ownerId: string,
    preferences: unknown,
    playerSteamId: string | null | undefined,
  ): Promise<CoachProfileDto> {
    const current = await this.coaching.profile(ownerId);
    await this.coaching.saveProfile(
      ownerId,
      parsePreferences(preferences ?? current.preferences),
      current.linkedToSteam
        ? null
        : playerSteamId === undefined
          ? current.playerSteamId
          : playerSteamId,
    );
    return view(await this.coaching.profile(ownerId));
  }
}
