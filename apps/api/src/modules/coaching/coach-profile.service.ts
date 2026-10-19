import { checkCustomInstructions, parsePreferences } from "@cs2/coaching";
import { ValidationError } from "../../shared/errors/index.js";
import type { CoachProfileDto, CoachProfileRecord } from "./coaching.dto.js";
import type { CoachingRepository } from "./coaching.repository.js";

const view = (p: CoachProfileRecord): CoachProfileDto => ({
  preferences: parsePreferences(p.preferences),
  playerSteamId: p.playerSteamId,
  linkedToSteam: p.linkedToSteam,
});

/**
 * Shown when custom instructions look like a prompt injection (the web translates by `code`).
 * Style, tone, role and focus requests are fine; links, code, role tags and requests to ignore
 * or reveal the coach's rules are not.
 */
export const UNSAFE_INSTRUCTIONS_MESSAGE =
  "These instructions can't be saved: describe how you want to be coached (tone, length, role, focus) without links, code or requests to change or reveal the coach's rules.";

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
    const next = parsePreferences(preferences ?? current.preferences);
    if (preferences !== undefined && preferences !== null) {
      const check = checkCustomInstructions(next.instructions);
      if (!check.ok)
        throw new ValidationError(UNSAFE_INSTRUCTIONS_MESSAGE, {
          code: "unsafe_instructions",
          details: { reasons: check.reasons },
        });
    }
    await this.coaching.saveProfile(
      ownerId,
      next,
      current.linkedToSteam
        ? null
        : playerSteamId === undefined
          ? current.playerSteamId
          : playerSteamId,
    );
    return view(await this.coaching.profile(ownerId));
  }
}
