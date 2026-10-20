import { z } from "zod";
import { LANGUAGE_CODES, type LanguageCode } from "@cs2/contracts/languages";
import type { SteamProfile } from "../../infrastructure/steam/steam-profile.types.js";
import type { Role } from "../../shared/http/principal.js";

/** GET /v1/me and POST /v1/me/refresh-profile response (plus plan/usage extras). */
export type MeDto = {
  ownerId: string;
  role: Role;
  steamId?: string;
  memberSince?: string;
  profile?: SteamProfile;
  /** Language chosen in the web selector (absent until chosen). */
  lang?: LanguageCode;
} & Record<string, unknown>;

/** PUT /v1/me/language body. */
export const languageBodySchema = z
  .object({ lang: z.enum(LANGUAGE_CODES) })
  .strict();
