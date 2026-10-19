import type { SteamProfile } from "../../infrastructure/steam/steam-profile.types.js";
import type { Role } from "../../shared/http/principal.js";

/** GET /v1/me and POST /v1/me/refresh-profile response (plus plan/usage extras). */
export type MeDto = {
  ownerId: string;
  role: Role;
  steamId?: string;
  memberSince?: string;
  profile?: SteamProfile;
} & Record<string, unknown>;
