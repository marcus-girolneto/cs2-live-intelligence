import type { CreditsDto } from "./credits.js";
import type { AccountPlanView, UsageView } from "./plans.js";

export type Role = "user" | "admin";

/** Cached public Steam profile (sanitized server-side). */
export type SteamProfileDto = {
  personaName: string;
  realName?: string;
  avatarUrl?: string;
  avatarMediumUrl?: string;
  profileUrl?: string;
  countryCode?: string;
  location?: string;
  summary?: string;
  steamMemberSince?: string;
  steamLevel?: number;
  personaState?: string;
  currentGame?: string;
  lastLogoff?: string;
  visibility: "public" | "friends" | "private";
  cs2?: { playtimeHours: number; playtime2WeeksHours?: number };
  bans?: {
    vacBans: number;
    gameBans: number;
    communityBanned: boolean;
    daysSinceLastBan?: number;
  };
  recentGames?: {
    appId: number;
    name: string;
    playtime2WeeksHours: number;
    iconUrl?: string;
  }[];
  friendsCount?: number;
  badgesCount?: number;
  groupsCount?: number;
  fetchedAt: string;
};

/** GET /v1/me and POST /v1/me/refresh-profile. */
export type MeDto = {
  ownerId: string;
  role: Role;
  steamId?: string;
  memberSince?: string;
  profile?: SteamProfileDto;
  plan: AccountPlanView;
  usage: UsageView;
  credits: CreditsDto;
  /** Effective demo upload limit in bytes (admin setting, default 500 MB). */
  uploadMaxBytes?: number;
};
/** 429 body of POST /v1/me/refresh-profile (also a retry-after header). */
export type RefreshThrottledDto = { error: string; retryAfterSeconds: number };
